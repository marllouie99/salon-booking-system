from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Booking, Transaction, Chat, Message
from salons.models import Salon, Service
from .payment_utils import create_payment, execute_payment, refund_payment
from .calendar_service import GoogleCalendarService
from activity_logger import log_user_activity, log_salon_activity, log_booking_activity, log_transaction_activity
from notifications.utils import create_booking_notification
import logging

# Import Brevo SDK if available
try:
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException
    BREVO_SDK_AVAILABLE = True
except ImportError:
    BREVO_SDK_AVAILABLE = False
    logging.warning("Brevo SDK not available. Email will use SMTP fallback.")

User = get_user_model()
logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_booking(request):
    """Create a new booking"""
    try:
        data = request.data
        
        # Validate required fields
        required_fields = ['salon_id', 'service_id', 'booking_date', 'booking_time', 'customer_name', 'customer_email', 'customer_phone']
        for field in required_fields:
            if not data.get(field):
                return Response({
                    'error': f'{field} is required'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get salon and service
        try:
            salon = Salon.objects.get(id=data.get('salon_id'))
            service = Service.objects.get(id=data.get('service_id'), salon=salon)
        except (Salon.DoesNotExist, Service.DoesNotExist):
            return Response({
                'error': 'Salon or service not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get payment method (default to paypal if not specified)
        payment_method = data.get('payment_method', 'paypal')
        
        # Set initial payment status based on payment method
        initial_payment_status = 'pending'
        if payment_method == 'pay_later':
            initial_payment_status = 'pending'  # Will be completed when booking is marked complete
        
        # Parse date and time strings
        booking_date_str = data.get('booking_date')
        booking_time_str = data.get('booking_time')
        
        # Convert date string to date object (format: YYYY-MM-DD)
        if isinstance(booking_date_str, str):
            booking_date = datetime.strptime(booking_date_str, '%Y-%m-%d').date()
        else:
            booking_date = booking_date_str
        
        # Convert time string to time object (format: HH:MM or HH:MM:SS)
        if isinstance(booking_time_str, str):
            try:
                booking_time = datetime.strptime(booking_time_str, '%H:%M:%S').time()
            except ValueError:
                booking_time = datetime.strptime(booking_time_str, '%H:%M').time()
        else:
            booking_time = booking_time_str
        
        # Check for booking conflicts (same salon, same date, overlapping time)
        from datetime import datetime as dt, timedelta
        
        # Calculate end time for the new booking
        booking_datetime = dt.combine(booking_date, booking_time)
        booking_end_time = (booking_datetime + timedelta(minutes=service.duration)).time()
        
        # Find existing bookings for the same salon and date (excluding cancelled and old pending)
        # Only consider pending bookings created in the last 15 minutes (payment window)
        from django.utils import timezone
        fifteen_minutes_ago = timezone.now() - timedelta(minutes=15)
        
        existing_bookings = Booking.objects.filter(
            salon=salon,
            booking_date=booking_date,
            status__in=['confirmed', 'completed']
        ) | Booking.objects.filter(
            salon=salon,
            booking_date=booking_date,
            status='pending',
            payment_status='pending',
            created_at__gte=fifteen_minutes_ago  # Only recent pending bookings
        )
        
        # Check for time conflicts
        for existing in existing_bookings:
            existing_datetime = dt.combine(existing.booking_date, existing.booking_time)
            existing_end_time = (existing_datetime + timedelta(minutes=existing.duration)).time()
            
            # Check if times overlap
            # Conflict if: new_start < existing_end AND new_end > existing_start
            if (booking_time < existing_end_time and booking_end_time > existing.booking_time):
                return Response({
                    'error': 'Time slot conflict',
                    'message': f'This time slot conflicts with an existing booking at {existing.booking_time.strftime("%I:%M %p")}. Please choose a different time.',
                    'conflicting_booking': {
                        'time': str(existing.booking_time),
                        'service': existing.service.name,
                        'duration': existing.duration
                    }
                }, status=status.HTTP_409_CONFLICT)
        
        # Create booking
        booking = Booking.objects.create(
            customer=request.user,
            salon=salon,
            service=service,
            booking_date=booking_date,
            booking_time=booking_time,
            duration=service.duration,
            customer_name=data.get('customer_name'),
            customer_email=data.get('customer_email'),
            customer_phone=data.get('customer_phone'),
            notes=data.get('notes', ''),
            price=service.price,
            status='pending',
            payment_method=payment_method,
            payment_status=initial_payment_status
        )
        
        # Create transaction record for pay_later bookings
        if payment_method == 'pay_later':
            Transaction.objects.create(
                booking=booking,
                customer=request.user,
                salon=salon,
                transaction_type='payment',
                amount=service.price,
                currency='PHP',
                status='pending',
                payment_method='pay_later',
                description=f'Pay later booking for {service.name} at {salon.name}'
            )
        
        # Log booking creation
        log_booking_activity(
            booking=booking,
            user=request.user,
            action="CREATED",
            details={
                'customer_name': booking.customer_name,
                'customer_phone': booking.customer_phone,
                'notes': booking.notes or 'None',
                'payment_method': payment_method
            },
            request=request
        )
        
        # Send confirmation emails
        send_booking_confirmation_email(booking)
        
        # Create notification for salon owner about new booking
        from notifications.models import Notification
        Notification.create_notification(
            user=salon.owner,
            notification_type='booking_confirmed',
            title='New Booking Received',
            message=f'New booking from {booking.customer_name} for {service.name} on {booking.booking_date} at {booking.booking_time}',
            action_url='/salon-owner-dashboard.html',
            related_object=booking,
            metadata={
                'booking_id': booking.id,
                'customer_name': booking.customer_name,
                'service_name': service.name,
                'booking_date': str(booking.booking_date),
                'booking_time': str(booking.booking_time)
            }
        )
        
        # Generate Google Calendar link
        calendar_link = GoogleCalendarService.generate_calendar_link(booking)
        
        return Response({
            'message': 'Booking created successfully',
            'booking': {
                'id': booking.id,
                'salon': salon.name,
                'service': service.name,
                'date': booking.booking_date,
                'time': str(booking.booking_time),
                'status': booking.status,
                'calendar_link': calendar_link
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_bookings(request):
    """Get all bookings for the logged-in user"""
    try:
        bookings = Booking.objects.filter(customer=request.user)
        
        bookings_data = []
        for booking in bookings:
            # Check if booking has a review
            from salons.models import Review
            review = Review.objects.filter(booking=booking, customer=request.user).first()
            
            # Get service images
            service_images = booking.service.images.all()
            service_image_urls = [request.build_absolute_uri(img.image.url) for img in service_images]
            
            bookings_data.append({
                'id': booking.id,
                'salon': {
                    'id': booking.salon.id,
                    'name': booking.salon.name,
                    'city': booking.salon.city
                },
                'service': {
                    'id': booking.service.id,
                    'name': booking.service.name,
                    'price': float(booking.service.price),
                    'images': service_image_urls
                },
                'booking_date': booking.booking_date,
                'booking_time': str(booking.booking_time),
                'duration': booking.duration,
                'status': booking.status,
                'payment_status': booking.payment_status,
                'payment_method': booking.payment_method,
                'price': float(booking.price),
                'created_at': booking.created_at,
                'has_review': review is not None,
                'review_rating': review.rating if review else None,
                'payment_id': booking.payment_id,
                'paypal_order_id': booking.paypal_order_id,
                'calendar_link': GoogleCalendarService.generate_calendar_link(booking)
            })
        
        return Response(bookings_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):
    """Cancel a pending booking"""
    try:
        # Get booking
        try:
            booking = Booking.objects.get(id=booking_id, customer=request.user)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if booking can be cancelled (only pending bookings)
        if booking.status != 'pending':
            return Response({
                'error': f'Cannot cancel {booking.status} booking. Only pending bookings can be cancelled.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update booking status
        booking.status = 'cancelled'
        booking.save()
        
        # Log activity
        log_booking_activity(
            booking=booking,
            user=request.user,
            action="CANCELLED",
            details={'reason': request.data.get('reason', 'Customer cancelled')},
            request=request
        )
        
        # Create notification for salon owner about cancellation
        from notifications.models import Notification
        Notification.create_notification(
            user=booking.salon.owner,
            notification_type='booking_cancelled',
            title='Booking Cancelled',
            message=f'{booking.customer_name} cancelled their booking for {booking.service.name} on {booking.booking_date}',
            action_url='/salon-owner-dashboard.html',
            related_object=booking,
            metadata={
                'booking_id': booking.id,
                'customer_name': booking.customer_name,
                'service_name': booking.service.name,
                'booking_date': str(booking.booking_date),
                'reason': request.data.get('reason', 'Not provided')
            }
        )
        
        # Send cancellation email to salon
        logger.info(f"📧 Attempting to send cancellation email to salon: {booking.salon.email}")
        print(f"📧 Attempting to send cancellation email to salon: {booking.salon.email}")
        
        try:
            subject = f'Booking Cancelled - {booking.salon.name}'
            message = f"""
Booking #{booking.id} has been cancelled by the customer.

Customer: {booking.customer_name}
Service: {booking.service.name}
Date: {booking.booking_date}
Time: {booking.booking_time}

Reason: {request.data.get('reason', 'Not provided')}
            """
            
            # Use Brevo API if available
            brevo_api_key = getattr(settings, 'BREVO_API_KEY', None)
            
            if brevo_api_key and BREVO_SDK_AVAILABLE:
                try:
                    configuration = sib_api_v3_sdk.Configuration()
                    configuration.api_key['api-key'] = brevo_api_key
                    
                    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                    
                    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                        to=[{"email": booking.salon.email, "name": booking.salon.name}],
                        sender={"email": settings.DEFAULT_FROM_EMAIL, "name": "Salon Booking System"},
                        subject=subject,
                        text_content=message
                    )
                    
                    api_response = api_instance.send_transac_email(send_smtp_email)
                    logger.info(f"✅ Cancellation email SENT via Brevo API - Message ID: {api_response.message_id}")
                    print(f"✅ Cancellation email SENT via Brevo API")
                    
                except ApiException as e:
                    logger.error(f"❌ Brevo API error: {e}")
                    print(f"❌ Brevo API error: {e}")
                    # Fall through to SMTP fallback
            else:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[booking.salon.email],
                    fail_silently=True,
                )
                logger.info(f"✅ Cancellation email SENT via SMTP")
                print(f"✅ Cancellation email SENT via SMTP")
                
        except Exception as e:
            logger.error(f"❌ Failed to send cancellation email: {e}", exc_info=True)
            print(f"❌ Failed to send cancellation email: {e}")
        
        return Response({
            'message': 'Booking cancelled successfully',
            'booking_id': booking.id
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_available_slots(request, salon_id):
    """Get available time slots for a salon on a specific date"""
    try:
        date_str = request.GET.get('date')
        if not date_str:
            return Response({
                'error': 'date parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse date
        booking_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Get salon
        try:
            salon = Salon.objects.get(id=salon_id)
        except Salon.DoesNotExist:
            return Response({
                'error': 'Salon not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get existing bookings for that date
        existing_bookings = Booking.objects.filter(
            salon=salon,
            booking_date=booking_date,
            status__in=['pending', 'confirmed']
        ).values_list('booking_time', flat=True)
        
        # Generate time slots (9 AM to 6 PM, hourly)
        available_slots = []
        start_hour = 9
        end_hour = 18
        
        for hour in range(start_hour, end_hour):
            time_slot = f"{hour:02d}:00:00"
            if time_slot not in [str(t) for t in existing_bookings]:
                available_slots.append({
                    'time': f"{hour:02d}:00",
                    'display': f"{hour % 12 or 12}:00 {'AM' if hour < 12 else 'PM'}"
                })
        
        return Response({
            'date': date_str,
            'available_slots': available_slots
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def send_booking_confirmation_email(booking):
    """Send booking confirmation email to customer and salon"""
    # Email to customer
    customer_subject = f'Booking Confirmation - {booking.salon.name}'
    customer_message = f"""
Dear {booking.customer_name},

Your booking has been confirmed!

Booking Details:
- Salon: {booking.salon.name}
- Service: {booking.service.name}
- Date: {booking.booking_date}
- Time: {booking.booking_time}
- Duration: {booking.duration} minutes
- Price: ${booking.price}

Location: {booking.salon.address}, {booking.salon.city}, {booking.salon.state}

If you need to cancel or reschedule, please contact the salon at {booking.salon.phone}.

Thank you for choosing {booking.salon.name}!

Best regards,
SalonBook Team
    """
    
    logger.info(f"📧 Attempting to send booking confirmation email to: {booking.customer_email}")
    print(f"📧 Attempting to send booking confirmation email to: {booking.customer_email}")
    
    try:
        # Use Brevo API if available
        brevo_api_key = getattr(settings, 'BREVO_API_KEY', None)
        
        if brevo_api_key and BREVO_SDK_AVAILABLE:
            try:
                configuration = sib_api_v3_sdk.Configuration()
                configuration.api_key['api-key'] = brevo_api_key
                
                api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                
                # Send to customer
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=[{"email": booking.customer_email, "name": booking.customer_name}],
                    sender={"email": settings.DEFAULT_FROM_EMAIL, "name": "Salon Booking System"},
                    subject=customer_subject,
                    text_content=customer_message
                )
                
                api_response = api_instance.send_transac_email(send_smtp_email)
                logger.info(f"✅ Customer booking confirmation SENT via Brevo API - Message ID: {api_response.message_id}")
                print(f"✅ Customer booking confirmation SENT via Brevo API")
                
            except ApiException as e:
                logger.error(f"❌ Brevo API error: {e}")
                print(f"❌ Brevo API error: {e}")
                # Fall through to SMTP fallback
        else:
            # Fallback to SMTP
            send_mail(
                subject=customer_subject,
                message=customer_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[booking.customer_email],
                fail_silently=False,
            )
            logger.info(f"✅ Customer booking confirmation SENT via SMTP")
            print(f"✅ Customer booking confirmation SENT via SMTP")
        
        # Email to salon owner
        salon_subject = f'New Booking - {booking.customer_name}'
        salon_message = f"""
New booking received!

Customer Details:
- Name: {booking.customer_name}
- Email: {booking.customer_email}
- Phone: {booking.customer_phone}

Booking Details:
- Service: {booking.service.name}
- Date: {booking.booking_date}
- Time: {booking.booking_time}
- Duration: {booking.duration} minutes
- Price: ${booking.price}

Notes: {booking.notes or 'None'}

Please confirm or manage this booking in your dashboard.
        """
        
        if brevo_api_key and BREVO_SDK_AVAILABLE:
            try:
                # Send to salon
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=[{"email": booking.salon.email, "name": booking.salon.name}],
                    sender={"email": settings.DEFAULT_FROM_EMAIL, "name": "Salon Booking System"},
                    subject=salon_subject,
                    text_content=salon_message
                )
                
                api_response = api_instance.send_transac_email(send_smtp_email)
                logger.info(f"✅ Salon booking notification SENT via Brevo API - Message ID: {api_response.message_id}")
                print(f"✅ Salon booking notification SENT via Brevo API")
                
            except ApiException as e:
                logger.error(f"❌ Brevo API error for salon: {e}")
                print(f"❌ Brevo API error for salon: {e}")
        else:
            send_mail(
                subject=salon_subject,
                message=salon_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[booking.salon.email],
                fail_silently=False,
            )
            logger.info(f"✅ Salon booking notification SENT via SMTP")
            print(f"✅ Salon booking notification SENT via SMTP")
            
    except Exception as e:
        logger.error(f"❌ Failed to send booking confirmation email: {e}", exc_info=True)
        print(f"❌ Failed to send booking confirmation email: {e}")


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_salon_bookings(request):
    """Get all bookings for the salon owner's salon"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all bookings for this salon
        bookings = Booking.objects.filter(salon=salon).select_related('customer', 'service')
        
        bookings_data = []
        for booking in bookings:
            # Get customer profile picture if available
            profile_picture_url = None
            if booking.customer.profile_picture:
                profile_picture_url = request.build_absolute_uri(booking.customer.profile_picture.url)
            
            bookings_data.append({
                'id': booking.id,
                'customer': {
                    'name': booking.customer_name,
                    'email': booking.customer_email,
                    'phone': booking.customer_phone,
                    'profile_picture': profile_picture_url
                },
                'service': {
                    'name': booking.service.name,
                    'price': float(booking.service.price),
                    'images': [request.build_absolute_uri(img.image.url) for img in booking.service.images.all()] if hasattr(booking.service, 'images') else []
                },
                'booking_date': booking.booking_date,
                'booking_time': str(booking.booking_time),
                'duration': booking.duration,
                'status': booking.status,
                'payment_status': booking.payment_status,
                'payment_method': booking.payment_method,
                'price': float(booking.price),
                'notes': booking.notes or '',
                'created_at': booking.created_at,
                'calendar_link': GoogleCalendarService.generate_calendar_link(booking)
            })
        
        return Response(bookings_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_booking_status(request, booking_id):
    """Update booking status (confirm, cancel, complete)"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get booking
        try:
            booking = Booking.objects.get(id=booking_id, salon=salon)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Update status
        new_status = request.data.get('status')
        if new_status not in ['pending', 'confirmed', 'completed', 'cancelled']:
            return Response({
                'error': 'Invalid status'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        old_status = booking.status
        booking.status = new_status
        booking.save()
        
        print(f"[STATUS] Booking #{booking.id} status changed: {old_status} -> {new_status}")
        print(f"[EMAIL] Calling send_status_update_email() for {booking.customer_email}")
        
        # Send status update email
        send_status_update_email(booking)
        
        # Create notification for customer about booking status change
        if new_status in ['confirmed', 'cancelled', 'completed']:
            create_booking_notification(booking, new_status)
        
        return Response({
            'message': f'Booking {new_status} successfully',
            'booking': {
                'id': booking.id,
                'status': booking.status
            }
        }, status=status.HTTP_200_OK)
        
    except Booking.DoesNotExist:
        return Response({
            'error': 'Booking not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_calendar_link(request, booking_id):
    """Get Google Calendar link for a specific booking"""
    try:
        # Get booking (customer can only access their own bookings)
        booking = Booking.objects.get(id=booking_id, customer=request.user)
        
        calendar_link = GoogleCalendarService.generate_calendar_link(booking)
        
        return Response({
            'calendar_link': calendar_link,
            'booking_id': booking.id
        }, status=status.HTTP_200_OK)
        
    except Booking.DoesNotExist:
        return Response({
            'error': 'Booking not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def send_status_update_email(booking):
    """Send email when booking status changes"""
    print(f"[EMAIL] send_status_update_email() called for booking #{booking.id}")
    print(f"   Status: {booking.status}")
    print(f"   Customer: {booking.customer_email}")
    
    status_messages = {
        'confirmed': 'confirmed',
        'cancelled': 'cancelled',
        'completed': 'completed'
    }
    
    if booking.status not in status_messages:
        print(f"[WARNING] Status '{booking.status}' not in email status list. No email sent.")
        return
    
    # Create appropriate subject and message based on status
    if booking.status == 'confirmed':
        subject = f'Booking Confirmed - {booking.salon.name}'
        
        # Check if payment is pending
        payment_reminder = ""
        if booking.payment_status == 'pending':
            payment_reminder = f"""
PAYMENT REQUIRED:
Your booking is confirmed, but payment is still pending.
Please complete your payment to secure your appointment.

Pay Now: {settings.FRONTEND_URL}/my-bookings
Amount: ${booking.price}
"""
        else:
            payment_reminder = "Payment: Already paid"
        
        message = f"""
Dear {booking.customer_name},

Great news! Your booking at {booking.salon.name} has been CONFIRMED!

BOOKING DETAILS:
================================
Salon: {booking.salon.name}
Service: {booking.service.name}
Date: {booking.booking_date.strftime('%A, %B %d, %Y')}
Time: {booking.booking_time.strftime('%I:%M %p')}
Duration: {booking.duration} minutes
Price: ${booking.price}

{payment_reminder}

Location: {booking.salon.address}, {booking.salon.city}
Contact: {booking.salon.phone}

We look forward to serving you!

Best regards,
SalonBook Team

================================
View your booking: {settings.FRONTEND_URL}/my-bookings
        """
    elif booking.status == 'cancelled':
        subject = f'Booking Cancelled - {booking.salon.name}'
        message = f"""
Dear {booking.customer_name},

Your booking at {booking.salon.name} has been cancelled.

Booking Details:
- Service: {booking.service.name}
- Date: {booking.booking_date}
- Time: {booking.booking_time}

If you have any questions, please contact the salon at {booking.salon.phone}.

We hope to serve you in the future.

Best regards,
SalonBook Team
        """
    elif booking.status == 'completed':
        subject = f'Service Completed - {booking.salon.name}'
        message = f"""
Dear {booking.customer_name},

Thank you for visiting {booking.salon.name}!

Your service has been marked as completed:
- Service: {booking.service.name}
- Date: {booking.booking_date}
- Time: {booking.booking_time}

We hope you enjoyed your experience! We'd love to see you again.

Best regards,
SalonBook Team
        """
    else:
        return
    
    logger.info(f"📧 Attempting to send status update email to: {booking.customer_email}")
    print(f"📧 Attempting to send status update email to: {booking.customer_email}")
    
    try:
        # Use Brevo API if available
        brevo_api_key = getattr(settings, 'BREVO_API_KEY', None)
        
        if brevo_api_key and BREVO_SDK_AVAILABLE:
            try:
                configuration = sib_api_v3_sdk.Configuration()
                configuration.api_key['api-key'] = brevo_api_key
                
                api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=[{"email": booking.customer_email, "name": booking.customer_name}],
                    sender={"email": settings.DEFAULT_FROM_EMAIL, "name": "Salon Booking System"},
                    subject=subject,
                    text_content=message
                )
                
                api_response = api_instance.send_transac_email(send_smtp_email)
                logger.info(f"✅ Status update email SENT via Brevo API - Message ID: {api_response.message_id}")
                print(f"[SUCCESS] Status update email sent to {booking.customer_email} for booking #{booking.id}")
                return
                
            except ApiException as e:
                logger.error(f"❌ Brevo API error: {e}")
                print(f"❌ Brevo API error: {e}")
                # Fall through to SMTP fallback
        
        # Fallback to SMTP
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[booking.customer_email],
            fail_silently=False,
        )
        logger.info(f"✅ Status update email SENT via SMTP")
        print(f"[SUCCESS] Status update email sent to {booking.customer_email} for booking #{booking.id}")
        
    except Exception as e:
        logger.error(f"❌ Failed to send status update email: {e}", exc_info=True)
        print(f"[ERROR] Failed to send status update email: {e}")
        # Log the error but don't fail the request
        import traceback
        traceback.print_exc()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment_for_booking(request):
    """Create PayPal payment for a booking"""
    try:
        booking_id = request.data.get('booking_id')
        
        if not booking_id:
            return Response({
                'error': 'Booking ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get booking
        try:
            booking = Booking.objects.get(id=booking_id, customer=request.user)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already paid
        if booking.payment_status == 'completed':
            return Response({
                'error': 'Booking already paid'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create PayPal payment
        payment_result = create_payment(
            amount=float(booking.price),
            description=f"Booking at {booking.salon.name} - {booking.service.name}"
        )
        
        if payment_result['success']:
            # Save payment ID to booking
            booking.payment_id = payment_result['payment_id']
            booking.save()
            
            # Create transaction record
            transaction = Transaction.objects.create(
                booking=booking,
                customer=request.user,
                salon=booking.salon,
                transaction_type='payment',
                amount=booking.price,
                currency='PHP',
                status='pending',
                payment_method='paypal',
                payment_provider_id=payment_result['payment_id'],
                description=f'PayPal payment for {booking.service.name} at {booking.salon.name}',
                metadata={
                    'service_name': booking.service.name,
                    'booking_date': booking.booking_date.isoformat(),
                    'booking_time': booking.booking_time.isoformat(),
                }
            )
            
            # Calculate platform fees (3%)
            transaction.calculate_platform_fee(0.03)
            transaction.save()
            
            # Log transaction creation
            log_transaction_activity(
                transaction=transaction,
                user=request.user,
                action="CREATED",
                details={
                    'payment_provider': 'PayPal',
                    'payment_id': payment_result['payment_id']
                },
                request=request
            )
            
            return Response({
                'success': True,
                'payment_id': payment_result['payment_id'],
                'approval_url': payment_result['approval_url'],
                'transaction_id': transaction.id
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'Failed to create payment',
                'details': payment_result.get('error')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def execute_booking_payment(request):
    """Execute/complete PayPal payment"""
    try:
        payment_id = request.data.get('payment_id')
        payer_id = request.data.get('payer_id')
        
        if not payment_id or not payer_id:
            return Response({
                'error': 'Payment ID and Payer ID are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find booking
        try:
            booking = Booking.objects.get(payment_id=payment_id, customer=request.user)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Execute payment
        payment_result = execute_payment(payment_id, payer_id)
        
        if payment_result['success']:
            # Update booking payment status and confirm booking
            booking.payment_status = 'completed'
            booking.status = 'confirmed'  # Auto-confirm booking when payment is completed
            booking.paypal_order_id = payment_result['payment'].id
            booking.save()
            
            # Log booking confirmation
            log_booking_activity(
                booking=booking,
                user=request.user,
                action="CONFIRMED",
                details={
                    'payment_method': 'paypal',
                    'payment_id': payment_id,
                    'auto_confirmed': True,
                    'reason': 'Payment completed successfully'
                },
                request=request
            )
            
            # Update transaction status
            try:
                transaction = Transaction.objects.get(
                    booking=booking,
                    payment_provider_id=payment_id,
                    status='pending'
                )
                transaction.status = 'completed'
                transaction.payment_provider_transaction_id = payment_result['payment'].id
                transaction.processed_at = timezone.now()
                
                # Update metadata with payment details
                transaction.metadata.update({
                    'payment_completed_at': timezone.now().isoformat(),
                    'payer_id': payer_id,
                    'payment_method': 'paypal'
                })
                transaction.save()
                
                # Log transaction completion
                log_transaction_activity(
                    transaction=transaction,
                    user=request.user,
                    action="COMPLETED",
                    details={
                        'payer_id': payer_id,
                        'paypal_transaction_id': payment_result['payment'].id
                    },
                    request=request
                )
                
            except Transaction.DoesNotExist:
                # Create transaction if doesn't exist (fallback)
                transaction = Transaction.objects.create(
                    booking=booking,
                    customer=booking.customer,
                    salon=booking.salon,
                    transaction_type='payment',
                    amount=booking.price,
                    currency='USD',
                    status='completed',
                    payment_method='paypal',
                    payment_provider_id=payment_id,
                    payment_provider_transaction_id=payment_result['payment'].id,
                    description=f"Payment for {booking.service.name} at {booking.salon.name}",
                    processed_at=timezone.now()
                )
                transaction.calculate_platform_fee(0.03)
                transaction.save()
            
            # Send confirmation email
            send_booking_confirmation_email(booking)
            
            # Create notification for customer about confirmed booking
            from notifications.models import Notification
            Notification.create_notification(
                user=booking.customer,
                notification_type='booking_confirmed',
                title='Booking Confirmed!',
                message=f'Your booking for {booking.service.name} at {booking.salon.name} on {booking.booking_date} at {booking.booking_time} has been confirmed. Payment received successfully.',
                action_url='/customer-bookings.html',
                related_object=booking,
                metadata={
                    'booking_id': booking.id,
                    'payment_method': 'paypal',
                    'payment_status': 'completed',
                    'booking_status': 'confirmed'
                }
            )
            
            # Create notification for salon owner
            Notification.create_notification(
                user=booking.salon.owner,
                notification_type='booking_confirmed',
                title='Booking Payment Received',
                message=f'Payment received for booking from {booking.customer_name} for {booking.service.name} on {booking.booking_date} at {booking.booking_time}. Booking is now confirmed.',
                action_url='/salon-owner-dashboard.html',
                related_object=booking,
                metadata={
                    'booking_id': booking.id,
                    'customer_name': booking.customer_name,
                    'payment_method': 'paypal',
                    'amount': str(booking.price)
                }
            )
            
            return Response({
                'success': True,
                'message': 'Payment completed successfully. Booking confirmed!',
                'booking': {
                    'id': booking.id,
                    'status': booking.status,
                    'payment_status': booking.payment_status
                },
                'transaction': {
                    'id': transaction.id,
                    'status': transaction.status,
                    'amount': str(transaction.amount)
                }
            }, status=status.HTTP_200_OK)
        else:
            booking.payment_status = 'failed'
            booking.save()
            
            # Update transaction status to failed
            try:
                transaction = Transaction.objects.get(
                    booking=booking,
                    payment_provider_id=payment_id,
                    status='pending'
                )
                transaction.status = 'failed'
                transaction.metadata.update({
                    'failure_reason': payment_result.get('error', 'Payment execution failed'),
                    'failed_at': timezone.now().isoformat()
                })
                transaction.save()
            except Transaction.DoesNotExist:
                pass
            
            return Response({
                'error': 'Payment execution failed',
                'details': payment_result.get('error')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_payment_status(request, booking_id):
    """Update booking payment status after PayPal capture"""
    try:
        # Get booking
        try:
            booking = Booking.objects.get(id=booking_id, customer=request.user)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Update payment information
        payment_status = request.data.get('payment_status', 'completed')
        paypal_order_id = request.data.get('paypal_order_id', '')
        payment_id = request.data.get('payment_id', '')
        
        booking.payment_status = payment_status
        booking.paypal_order_id = paypal_order_id
        booking.payment_id = payment_id
        booking.save()
        
        # Create or update transaction record if payment is completed
        if payment_status == 'completed':
            try:
                # Try to find existing pending transaction
                transaction = Transaction.objects.get(
                    booking=booking,
                    status='pending'
                )
                # Update existing transaction
                transaction.status = 'completed'
                transaction.payment_provider_transaction_id = paypal_order_id
                transaction.processed_at = timezone.now()
                transaction.metadata.update({
                    'payment_completed_at': timezone.now().isoformat(),
                    'payment_method': 'paypal',
                    'updated_via': 'update_payment_status'
                })
                transaction.save()
                
            except Transaction.DoesNotExist:
                # Create new transaction if none exists
                transaction = Transaction.objects.create(
                    booking=booking,
                    customer=booking.customer,
                    salon=booking.salon,
                    transaction_type='payment',
                    amount=booking.price,
                    currency='USD',
                    status='completed',
                    payment_method='paypal',
                    payment_provider_id=payment_id,
                    payment_provider_transaction_id=paypal_order_id,
                    description=f"Payment for {booking.service.name} at {booking.salon.name}",
                    processed_at=timezone.now(),
                    metadata={
                        'service_name': booking.service.name,
                        'booking_date': booking.booking_date.isoformat(),
                        'booking_time': booking.booking_time.isoformat(),
                        'created_via': 'update_payment_status'
                    }
                )
                
                # Calculate platform fees (3%)
                transaction.calculate_platform_fee(0.03)
                transaction.save()
        
        return Response({
            'success': True,
            'message': 'Payment status updated successfully',
            'transaction_created': payment_status == 'completed'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refund_booking_payment(request, booking_id):
    """Refund a booking payment (salon owner only)"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get booking
        try:
            booking = Booking.objects.get(id=booking_id, salon=salon)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if payment can be refunded
        if booking.payment_status != 'completed':
            return Response({
                'error': 'Booking payment is not completed'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if booking.payment_status == 'refunded':
            return Response({
                'error': 'Booking already refunded'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Process refund
        # Note: PayPal refund requires the sale ID, not payment ID
        # For now, we'll mark as refunded (you need to get sale ID from payment details)
        booking.payment_status = 'refunded'
        booking.status = 'cancelled'
        booking.save()
        
        # Send cancellation email
        send_status_update_email(booking)
        
        # Create notification for customer about refund
        create_booking_notification(booking, 'cancelled')
        
        return Response({
            'success': True,
            'message': 'Booking refunded successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_transactions(request):
    """Get transactions for the authenticated user"""
    try:
        # Get transactions for the user
        transactions = Transaction.objects.filter(
            customer=request.user
        ).select_related('booking', 'salon', 'booking__service').order_by('-created_at')
        
        # Paginate results (optional)
        limit = min(int(request.GET.get('limit', 20)), 100)  # Max 100 per request
        offset = int(request.GET.get('offset', 0))
        
        total_count = transactions.count()
        transactions = transactions[offset:offset + limit]
        
        # Serialize transaction data
        transactions_data = []
        for transaction in transactions:
            transactions_data.append({
                'id': transaction.id,
                'transaction_id': f"TXN-{transaction.id:06d}",
                'booking_id': transaction.booking.id,
                'salon_name': transaction.salon.name,
                'service_name': transaction.booking.service.name,
                'transaction_type': transaction.transaction_type,
                'amount': float(transaction.amount),
                'currency': transaction.currency,
                'status': transaction.status,
                'payment_method': transaction.payment_method,
                'description': transaction.description,
                'platform_fee': float(transaction.platform_fee),
                'net_amount': float(transaction.net_amount),
                'created_at': transaction.created_at.isoformat(),
                'processed_at': transaction.processed_at.isoformat() if transaction.processed_at else None,
                'metadata': transaction.metadata
            })
        
        return Response({
            'transactions': transactions_data,
            'pagination': {
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_more': offset + limit < total_count
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_salon_transactions(request):
    """Get transactions for salon owner's salons"""
    try:
        # Check if user is a salon owner
        if not hasattr(request.user, 'owned_salons') or not request.user.owned_salons.exists():
            return Response({
                'error': 'Access denied. User is not a salon owner.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get transactions for user's salons
        salon_ids = request.user.owned_salons.values_list('id', flat=True)
        transactions = Transaction.objects.filter(
            salon_id__in=salon_ids
        ).select_related('booking', 'customer', 'booking__service').order_by('-created_at')
        
        # Paginate results
        limit = min(int(request.GET.get('limit', 20)), 100)
        offset = int(request.GET.get('offset', 0))
        
        total_count = transactions.count()
        transactions = transactions[offset:offset + limit]
        
        # Serialize transaction data
        transactions_data = []
        for transaction in transactions:
            transactions_data.append({
                'id': transaction.id,
                'transaction_id': f"TXN-{transaction.id:06d}",
                'booking_id': transaction.booking.id,
                'booking_status': transaction.booking.status,
                'customer_name': transaction.customer.get_full_name() or transaction.customer.email,
                'customer_email': transaction.customer.email,
                'salon_name': transaction.salon.name,
                'service_name': transaction.booking.service.name,
                'transaction_type': transaction.transaction_type,
                'amount': float(transaction.amount),
                'currency': transaction.currency,
                'status': transaction.status,
                'payment_method': transaction.payment_method,
                'platform_fee': float(transaction.platform_fee),
                'salon_payout': float(transaction.salon_payout),
                'net_amount': float(transaction.net_amount),
                'created_at': transaction.created_at.isoformat(),
                'processed_at': transaction.processed_at.isoformat() if transaction.processed_at else None,
                'booking_date': transaction.booking.booking_date.isoformat(),
                'booking_time': transaction.booking.booking_time.isoformat(),
                'payment_provider_id': transaction.payment_provider_id or '',
            })
        
        # Calculate totals for salon owner
        # Use salon_payout if available, otherwise use amount (assuming full amount goes to salon)
        total_revenue = sum(
            (t['salon_payout'] if t['salon_payout'] > 0 else t['amount'])
            for t in transactions_data if t['status'].lower() == 'completed'
        )
        total_fees = sum(t['platform_fee'] for t in transactions_data if t['status'].lower() == 'completed')
        
        # Count pending payments
        pending_payments = sum(
            t['amount'] for t in transactions_data if t['status'].lower() == 'pending'
        )
        
        return Response({
            'transactions': transactions_data,
            'summary': {
                'total_revenue': total_revenue,
                'pending_payments': pending_payments,
                'total_platform_fees': total_fees,
                'transaction_count': total_count
            },
            'pagination': {
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_more': offset + limit < total_count
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========================
# Chat API Endpoints
# ========================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def chat_with_salon(request, salon_id):
    """Get or create a chat with a specific salon"""
    try:
        # Get salon
        try:
            salon = Salon.objects.get(id=salon_id)
        except Salon.DoesNotExist:
            return Response({
                'error': 'Salon not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Prevent salon owners from chatting with their own salon
        if hasattr(request.user, 'owned_salons') and request.user.owned_salons.filter(id=salon_id).exists():
            return Response({
                'error': 'You cannot chat with your own salon'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if request.method == 'GET':
            # Get existing chat or return empty if none exists
            try:
                chat = Chat.objects.get(customer=request.user, salon=salon)
                print(f"DEBUG: Found chat ID: {chat.id}, customer: {chat.customer.email}, salon: {chat.salon.name}")
                
                # Get messages for this chat
                messages = Message.objects.filter(chat=chat).order_by('sent_at')
                print(f"DEBUG: Total messages in DB for chat {chat.id}: {messages.count()}")
                for msg in messages:
                    print(f"  - Message {msg.id}: {msg.sender_type} - {msg.content[:30]}")
                
                messages = messages[:50]
                
                # Mark salon messages as read by customer
                Message.objects.filter(
                    chat=chat, 
                    sender_type='salon', 
                    is_read=False
                ).update(is_read=True, read_at=timezone.now())
                
                messages_data = []
                for message in messages:
                    message_dict = {
                        'id': message.id,
                        'sender_type': message.sender_type,
                        'message_type': message.message_type,
                        'content': message.content,
                        'sent_at': message.sent_at.isoformat(),
                        'is_read': message.is_read
                    }
                    # Add image URL if message has an image
                    if message.image:
                        message_dict['image_url'] = message.image.url
                    
                    # Add sender profile picture
                    if message.sender_type == 'customer':
                        if chat.customer.profile_picture:
                            message_dict['sender_profile_picture'] = chat.customer.profile_picture.url
                        message_dict['sender_name'] = chat.customer.get_full_name() or 'Customer'
                    else:  # salon
                        # Get salon owner's profile picture
                        salon_owner = chat.salon.owner
                        if salon_owner.profile_picture:
                            message_dict['sender_profile_picture'] = salon_owner.profile_picture.url
                        message_dict['sender_name'] = chat.salon.name
                    
                    messages_data.append(message_dict)
                
                return Response({
                    'chat': {
                        'id': chat.id,
                        'salon_name': salon.name,
                        'salon_id': salon.id,
                        'created_at': chat.created_at.isoformat()
                    },
                    'messages': messages_data
                }, status=status.HTTP_200_OK)
                
            except Chat.DoesNotExist:
                return Response({
                    'chat': None,
                    'messages': []
                }, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Send a new message
            content = request.data.get('content', '').strip()
            message_type = request.data.get('message_type', 'text')
            
            if not content:
                return Response({
                    'error': 'Message content is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get or create chat
            chat, created = Chat.objects.get_or_create(
                customer=request.user,
                salon=salon,
                defaults={'is_active': True}
            )
            
            # Create message
            message = Message.objects.create(
                chat=chat,
                sender_type='customer',
                message_type=message_type,
                content=content
            )
            
            # Update chat timestamp
            chat.updated_at = timezone.now()
            chat.save()
            
            # Log chat activity
            log_user_activity(
                user=request.user,
                action="MESSAGE SENT",
                details={
                    'salon_name': salon.name,
                    'message_type': message_type,
                    'chat_id': chat.id
                },
                request=request
            )
            
            return Response({
                'message': {
                    'id': message.id,
                    'sender_type': message.sender_type,
                    'message_type': message.message_type,
                    'content': message.content,
                    'sent_at': message.sent_at.isoformat(),
                    'is_read': message.is_read
                },
                'chat_id': chat.id
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_chats(request):
    """Get all chats for the authenticated user"""
    try:
        chats = Chat.objects.filter(
            customer=request.user,
            is_active=True
        ).select_related('salon').order_by('-updated_at')
        
        chats_data = []
        for chat in chats:
            last_message = chat.last_message
            chats_data.append({
                'id': chat.id,
                'salon': {
                    'id': chat.salon.id,
                    'name': chat.salon.name,
                    'city': chat.salon.city
                },
                'last_message': {
                    'content': last_message.content if last_message else None,
                    'sender_type': last_message.sender_type if last_message else None,
                    'sent_at': last_message.sent_at.isoformat() if last_message else None
                } if last_message else None,
                'unread_count': chat.unread_count_for_customer,
                'updated_at': chat.updated_at.isoformat()
            })
        
        return Response({
            'chats': chats_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_messages(request, salon_id):
    """Get or create chat and retrieve messages between customer and salon"""
    try:
        salon = Salon.objects.get(id=salon_id)
        
        # Get or create chat
        chat, created = Chat.objects.get_or_create(
            customer=request.user,
            salon=salon,
            defaults={'is_active': True}
        )
        
        # Get messages
        messages = Message.objects.filter(chat=chat).order_by('sent_at')
        
        messages_data = [{
            'id': msg.id,
            'content': msg.content,
            'message_type': msg.message_type,
            'sender_type': msg.sender_type,
            'sent_at': msg.sent_at.isoformat(),
            'is_read': msg.is_read,
            'image': msg.image.url if msg.image else None
        } for msg in messages]
        
        return Response({
            'chat_id': chat.id,
            'messages': messages_data
        }, status=status.HTTP_200_OK)
        
    except Salon.DoesNotExist:
        return Response({'error': 'Salon not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request, salon_id):
    """Send a message from customer to salon"""
    try:
        salon = Salon.objects.get(id=salon_id)
        
        # Check if user is salon owner or customer
        is_salon_owner = salon.owner == request.user
        
        if is_salon_owner:
            return Response({'error': 'Salon owners cannot initiate chats. Customers must start the conversation first.'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create chat (customer to salon)
        chat, created = Chat.objects.get_or_create(
            customer=request.user,
            salon=salon,
            defaults={'is_active': True}
        )
        
        # Create message
        message = Message.objects.create(
            chat=chat,
            sender_type='customer',
            content=request.data.get('content', ''),
            message_type=request.data.get('message_type', 'text'),
            image=request.FILES.get('image') if 'image' in request.FILES else None
        )
        
        return Response({
            'id': message.id,
            'content': message.content,
            'message_type': message.message_type,
            'sender_type': message.sender_type,
            'sent_at': message.sent_at.isoformat(),
            'image': message.image.url if message.image else None,
            'chat_id': chat.id
        }, status=status.HTTP_201_CREATED)
        
    except Salon.DoesNotExist:
        return Response({'error': 'Salon not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_message_as_read(request, message_id):
    """Mark a message as read"""
    try:
        message = Message.objects.get(id=message_id)
        
        # Verify access
        if message.chat.customer != request.user and message.chat.salon.owner != request.user:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        message.is_read = True
        message.read_at = timezone.now()
        message.save()
        
        return Response({'success': True}, status=status.HTTP_200_OK)
        
    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_salon_chats(request):
    """Get all chats for salon owner - optionally for a specific salon"""
    try:
        # Check if user is a salon owner
        if not hasattr(request.user, 'owned_salons') or not request.user.owned_salons.exists():
            return Response({
                'error': 'Access denied. User is not a salon owner.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get salon_id from query parameter if provided
        salon_id = request.query_params.get('salon_id')
        
        if salon_id:
            # Get specific salon if user owns it
            try:
                salon = request.user.owned_salons.get(id=salon_id)
            except:
                return Response({
                    'error': 'Salon not found or access denied.'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            # Default to first salon
            salon = request.user.owned_salons.first()
        
        chats = Chat.objects.filter(
            salon=salon,
            is_active=True
        ).select_related('customer').order_by('-updated_at')
        
        chats_data = []
        for chat in chats:
            last_message = chat.last_message
            
            # Get all messages for this chat
            messages = Message.objects.filter(chat=chat).order_by('sent_at')
            messages_data = []
            for message in messages:
                message_dict = {
                    'id': message.id,
                    'sender_type': message.sender_type,
                    'message_type': message.message_type,
                    'content': message.content,
                    'sent_at': message.sent_at.isoformat(),
                    'is_read': message.is_read
                }
                # Add image URL if message has an image
                if message.image:
                    message_dict['image_url'] = message.image.url
                
                # Add sender profile picture
                if message.sender_type == 'customer':
                    if chat.customer.profile_picture:
                        message_dict['sender_profile_picture'] = chat.customer.profile_picture.url
                    message_dict['sender_name'] = chat.customer.get_full_name() or 'Customer'
                else:  # salon
                    salon_owner = chat.salon.owner
                    if salon_owner.profile_picture:
                        message_dict['sender_profile_picture'] = salon_owner.profile_picture.url
                    message_dict['sender_name'] = chat.salon.name
                
                messages_data.append(message_dict)
            
            chats_data.append({
                'id': chat.id,
                'customer': {
                    'id': chat.customer.id,
                    'name': chat.customer.get_full_name() or 'Customer',
                    'email': chat.customer.email
                },
                'last_message': {
                    'content': last_message.content if last_message else None,
                    'sender_type': last_message.sender_type if last_message else None,
                    'sent_at': last_message.sent_at.isoformat() if last_message else None
                } if last_message else None,
                'messages': messages_data,
                'unread_count': chat.unread_count_for_salon,
                'updated_at': chat.updated_at.isoformat()
            })
        
        # Get all owned salons for salon selector
        owned_salons = []
        for s in request.user.owned_salons.all():
            owned_salons.append({
                'id': s.id,
                'name': s.name,
                'is_active': s.id == salon.id
            })
        
        return Response({
            'chats': chats_data,
            'current_salon': {
                'id': salon.id,
                'name': salon.name
            },
            'owned_salons': owned_salons
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_salon_chat_messages(request, customer_id):
    """Get chat messages between salon and a specific customer"""
    try:
        # Check if user is a salon owner
        if not hasattr(request.user, 'owned_salons') or not request.user.owned_salons.exists():
            return Response({
                'error': 'Access denied. User is not a salon owner.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        salon = request.user.owned_salons.first()
        
        # Get customer
        try:
            customer = User.objects.get(id=customer_id)
        except User.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create chat
        chat, created = Chat.objects.get_or_create(
            customer=customer,
            salon=salon,
            defaults={'is_active': True}
        )
        
        # Get messages
        messages = Message.objects.filter(chat=chat).order_by('sent_at')
        
        messages_data = [{
            'id': msg.id,
            'content': msg.content,
            'message_type': msg.message_type,
            'sender_type': msg.sender_type,
            'sent_at': msg.sent_at.isoformat(),
            'is_read': msg.is_read,
            'image': msg.image.url if msg.image else None
        } for msg in messages]
        
        return Response({
            'chat_id': chat.id,
            'messages': messages_data,
            'customer': {
                'id': customer.id,
                'name': f'{customer.first_name} {customer.last_name}',
                'email': customer.email
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_salon_message(request, customer_id):
    """Send message from salon to customer"""
    try:
        # Check if user is a salon owner
        if not hasattr(request.user, 'owned_salons') or not request.user.owned_salons.exists():
            return Response({
                'error': 'Access denied. User is not a salon owner.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        salon = request.user.owned_salons.first()
        
        # Get customer
        try:
            customer = User.objects.get(id=customer_id)
        except User.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get or create chat
        chat, created = Chat.objects.get_or_create(
            customer=customer,
            salon=salon,
            defaults={'is_active': True}
        )
        
        content = request.data.get('content', '').strip()
        message_type = request.data.get('message_type', 'text')
        image = request.FILES.get('image', None)
        
        if not content and not image:
            return Response({
                'error': 'Message content or image is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create message
        message = Message.objects.create(
            chat=chat,
            sender_type='salon',
            message_type=message_type,
            content=content,
            image=image
        )
        
        # Update chat timestamp
        chat.updated_at = timezone.now()
        chat.save()
        
        # Log activity
        log_salon_activity(
            salon=salon,
            user=request.user,
            action="MESSAGE SENT",
            details={
                'customer_email': chat.customer.email,
                'message_type': message_type,
                'chat_id': chat.id
            },
            request=request
        )
        
        response_data = {
            'message': {
                'id': message.id,
                'sender_type': message.sender_type,
                'message_type': message.message_type,
                'content': message.content,
                'sent_at': message.sent_at.isoformat(),
                'is_read': message.is_read
            }
        }
        
        # Add image URL if message has an image
        if message.image:
            response_data['message']['image_url'] = message.image.url
            response_data['image_url'] = message.image.url
        
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_available_slots(request):
    """Check available time slots for a salon on a specific date"""
    try:
        salon_id = request.GET.get('salon_id')
        date_str = request.GET.get('date')
        service_id = request.GET.get('service_id')
        
        if not all([salon_id, date_str, service_id]):
            return Response({
                'error': 'salon_id, date, and service_id are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get salon and service
        try:
            salon = Salon.objects.get(id=salon_id)
            service = Service.objects.get(id=service_id, salon=salon)
        except (Salon.DoesNotExist, Service.DoesNotExist):
            return Response({
                'error': 'Salon or service not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Parse date
        from datetime import datetime as dt, timedelta, time
        booking_date = dt.strptime(date_str, '%Y-%m-%d').date()
        
        # Define business hours (9 AM to 6 PM)
        start_hour = 9
        end_hour = 18
        slot_interval = 30  # 30-minute intervals
        
        # Get existing bookings for this date
        existing_bookings = Booking.objects.filter(
            salon=salon,
            booking_date=booking_date,
            status__in=['pending', 'confirmed', 'completed']
        )
        
        # Generate all possible time slots
        available_slots = []
        current_time = time(start_hour, 0)
        end_time = time(end_hour, 0)
        
        while current_time < end_time:
            # Calculate slot end time
            current_datetime = dt.combine(booking_date, current_time)
            slot_end_datetime = current_datetime + timedelta(minutes=service.duration)
            slot_end_time = slot_end_datetime.time()
            
            # Check if this slot conflicts with any existing booking
            is_available = True
            for existing in existing_bookings:
                existing_datetime = dt.combine(existing.booking_date, existing.booking_time)
                existing_end_time = (existing_datetime + timedelta(minutes=existing.duration)).time()
                
                # Check overlap
                if (current_time < existing_end_time and slot_end_time > existing.booking_time):
                    is_available = False
                    break
            
            # Only add if slot end time is within business hours
            if slot_end_time <= end_time and is_available:
                available_slots.append({
                    'time': current_time.strftime('%H:%M'),
                    'display_time': current_time.strftime('%I:%M %p'),
                    'end_time': slot_end_time.strftime('%H:%M'),
                    'available': True
                })
            
            # Move to next slot
            current_datetime += timedelta(minutes=slot_interval)
            current_time = current_datetime.time()
        
        return Response({
            'date': date_str,
            'salon': salon.name,
            'service': service.name,
            'duration': service.duration,
            'available_slots': available_slots,
            'total_slots': len(available_slots)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ======================
# STRIPE PAYMENT ENDPOINTS
# ======================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_stripe_checkout_session(request, booking_id):
    """Create Stripe checkout session for a booking"""
    try:
        import stripe
        from django.conf import settings
        
        # Configure Stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        
        # Debug logging
        print(f"[STRIPE] Creating checkout for booking {booking_id}")
        print(f"[STRIPE] API key configured: {bool(stripe.api_key)}")
        print(f"[STRIPE] API key starts with: {stripe.api_key[:15] if stripe.api_key else 'None'}")
        
        # Get booking
        try:
            booking = Booking.objects.get(id=booking_id, customer=request.user)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already paid
        if booking.payment_status == 'completed':
            return Response({
                'error': 'Booking already paid'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create Stripe checkout session
        try:
            # Convert PHP to cents (Stripe uses smallest currency unit)
            amount_in_cents = int(float(booking.price) * 100)
            
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'php',
                        'unit_amount': amount_in_cents,
                        'product_data': {
                            'name': f'{booking.service.name} at {booking.salon.name}',
                            'description': f'Booking on {booking.booking_date} at {booking.booking_time}',
                            'images': [],  # You can add service images here
                        },
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f'{settings.FRONTEND_URL}/my-bookings?payment=success&booking_id={booking.id}&session_id={{CHECKOUT_SESSION_ID}}',
                cancel_url=f'{settings.FRONTEND_URL}/my-bookings?payment=cancelled&booking_id={booking.id}',
                client_reference_id=str(booking.id),
                customer_email=booking.customer_email,
                metadata={
                    'booking_id': booking.id,
                    'salon_id': booking.salon.id,
                    'service_id': booking.service.id,
                    'customer_id': request.user.id,
                }
            )
            
            # Update booking with payment method
            booking.payment_method = 'stripe'
            booking.save()
            
            # Create pending transaction
            transaction = Transaction.objects.create(
                booking=booking,
                customer=request.user,
                salon=booking.salon,
                transaction_type='payment',
                amount=booking.price,
                currency='PHP',
                status='pending',
                payment_method='stripe',
                payment_provider_id=checkout_session.id,
                description=f'Stripe payment for {booking.service.name} at {booking.salon.name}',
                metadata={
                    'service_name': booking.service.name,
                    'booking_date': booking.booking_date.isoformat(),
                    'booking_time': booking.booking_time.isoformat(),
                    'checkout_session_id': checkout_session.id
                }
            )
            
            # Calculate platform fees (3%)
            transaction.calculate_platform_fee(0.03)
            transaction.save()
            
            # Log transaction creation
            log_transaction_activity(
                transaction=transaction,
                user=request.user,
                action="CREATED",
                details={
                    'payment_provider': 'Stripe',
                    'checkout_session_id': checkout_session.id
                },
                request=request
            )
            
            return Response({
                'success': True,
                'checkout_url': checkout_session.url,
                'session_id': checkout_session.id,
                'transaction_id': transaction.id
            }, status=status.HTTP_200_OK)
            
        except stripe.error.StripeError as e:
            print(f"[STRIPE ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': 'Stripe error',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        print(f"[ERROR] create_stripe_checkout_session: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])  # Webhook doesn't use authentication
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        import stripe
        from django.conf import settings
        from django.http import HttpResponse
        
        logger.info("[STRIPE WEBHOOK] Received webhook request")
        
        # Configure Stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        webhook_secret = settings.STRIPE_WEBHOOK_SECRET
        
        logger.info(f"[STRIPE WEBHOOK] Webhook secret configured: {bool(webhook_secret)}")
        
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        logger.info(f"[STRIPE WEBHOOK] Signature header present: {bool(sig_header)}")
        
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
            logger.info(f"[STRIPE WEBHOOK] Event verified: {event['type']}")
        except ValueError as e:
            # Invalid payload
            logger.error(f"[STRIPE WEBHOOK] Invalid payload: {str(e)}")
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError as e:
            # Invalid signature
            logger.error(f"[STRIPE WEBHOOK] Invalid signature: {str(e)}")
            return HttpResponse(status=400)
        
        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            logger.info(f"[STRIPE WEBHOOK] Processing checkout.session.completed")
            
            # Get booking ID from metadata
            booking_id = session.get('client_reference_id') or session['metadata'].get('booking_id')
            logger.info(f"[STRIPE WEBHOOK] Booking ID from session: {booking_id}")
            
            if booking_id:
                try:
                    booking = Booking.objects.get(id=booking_id)
                    logger.info(f"[STRIPE WEBHOOK] Found booking #{booking.id}, current status: {booking.status}, payment_status: {booking.payment_status}")
                    
                    # Update booking payment status and confirm booking
                    booking.payment_status = 'completed'
                    booking.status = 'confirmed'  # Auto-confirm booking when payment is completed
                    booking.payment_id = session['payment_intent']
                    booking.payment_method = 'stripe'
                    booking.save()
                    
                    logger.info(f"[STRIPE WEBHOOK] ✅ Booking #{booking.id} updated to CONFIRMED and PAID")
                    
                    # Log booking confirmation
                    log_booking_activity(
                        booking=booking,
                        user=booking.customer,
                        action="CONFIRMED",
                        details={
                            'payment_method': 'stripe',
                            'session_id': session['id'],
                            'payment_intent': session['payment_intent'],
                            'auto_confirmed': True,
                            'reason': 'Payment completed successfully via webhook'
                        },
                        request=None
                    )
                    
                    # Update transaction
                    try:
                        transaction = Transaction.objects.get(
                            booking=booking,
                            payment_provider_id=session['id'],
                            status='pending'
                        )
                        transaction.status = 'completed'
                        transaction.payment_provider_transaction_id = session['payment_intent']
                        transaction.processed_at = timezone.now()
                        transaction.metadata.update({
                            'payment_completed_at': timezone.now().isoformat(),
                            'stripe_session_id': session['id'],
                            'stripe_payment_intent': session['payment_intent']
                        })
                        transaction.save()
                        
                        logger.info(f"[STRIPE WEBHOOK] Transaction updated to completed")
                        
                    except Transaction.DoesNotExist:
                        # Create transaction if doesn't exist
                        transaction = Transaction.objects.create(
                            booking=booking,
                            customer=booking.customer,
                            salon=booking.salon,
                            transaction_type='payment',
                            amount=booking.price,
                            currency='PHP',
                            status='completed',
                            payment_method='stripe',
                            payment_provider_id=session['id'],
                            payment_provider_transaction_id=session['payment_intent'],
                            description=f"Stripe payment for {booking.service.name} at {booking.salon.name}",
                            processed_at=timezone.now()
                        )
                        transaction.calculate_platform_fee(0.03)
                        transaction.save()
                    
                    # Send confirmation email
                    send_booking_confirmation_email(booking)
                    
                    # Create notification for customer about confirmed booking
                    from notifications.models import Notification
                    Notification.create_notification(
                        user=booking.customer,
                        notification_type='booking_confirmed',
                        title='Booking Confirmed!',
                        message=f'Your booking for {booking.service.name} at {booking.salon.name} on {booking.booking_date} at {booking.booking_time} has been confirmed. Payment received successfully.',
                        action_url='/customer-bookings.html',
                        related_object=booking,
                        metadata={
                            'booking_id': booking.id,
                            'payment_method': 'stripe',
                            'payment_status': 'completed',
                            'booking_status': 'confirmed'
                        }
                    )
                    
                    # Create notification for salon owner
                    Notification.create_notification(
                        user=booking.salon.owner,
                        notification_type='booking_confirmed',
                        title='Booking Payment Received',
                        message=f'Payment received for booking from {booking.customer_name} for {booking.service.name} on {booking.booking_date} at {booking.booking_time}. Booking is now confirmed.',
                        action_url='/salon-owner-dashboard.html',
                        related_object=booking,
                        metadata={
                            'booking_id': booking.id,
                            'customer_name': booking.customer_name,
                            'payment_method': 'stripe',
                            'amount': str(booking.price)
                        }
                    )
                    
                except Booking.DoesNotExist:
                    print(f"[STRIPE] Booking {booking_id} not found")
        
        elif event['type'] == 'checkout.session.expired':
            session = event['data']['object']
            booking_id = session.get('client_reference_id') or session['metadata'].get('booking_id')
            
            if booking_id:
                try:
                    booking = Booking.objects.get(id=booking_id)
                    
                    # Update transaction to failed
                    try:
                        transaction = Transaction.objects.get(
                            booking=booking,
                            payment_provider_id=session['id'],
                            status='pending'
                        )
                        transaction.status = 'failed'
                        transaction.metadata.update({
                            'failure_reason': 'Checkout session expired',
                            'failed_at': timezone.now().isoformat()
                        })
                        transaction.save()
                    except Transaction.DoesNotExist:
                        pass
                        
                except Booking.DoesNotExist:
                    pass
        
        elif event['type'] == 'payment_intent.payment_failed':
            payment_intent = event['data']['object']
            
            # Try to find booking by payment intent
            try:
                booking = Booking.objects.get(payment_id=payment_intent['id'])
                booking.payment_status = 'failed'
                booking.save()
                
                # Update transaction
                try:
                    transaction = Transaction.objects.get(
                        booking=booking,
                        payment_provider_transaction_id=payment_intent['id']
                    )
                    transaction.status = 'failed'
                    transaction.metadata.update({
                        'failure_reason': payment_intent.get('last_payment_error', {}).get('message', 'Payment failed'),
                        'failed_at': timezone.now().isoformat()
                    })
                    transaction.save()
                except Transaction.DoesNotExist:
                    pass
                    
            except Booking.DoesNotExist:
                pass
        
        return HttpResponse(status=200)
        
    except Exception as e:
        print(f"[STRIPE WEBHOOK ERROR] {str(e)}")
        return HttpResponse(status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_stripe_payment(request, booking_id):
    """Verify Stripe payment after redirect (fallback if webhook fails)"""
    try:
        import stripe
        from django.conf import settings
        
        stripe.api_key = settings.STRIPE_SECRET_KEY
        
        # Get booking
        try:
            booking = Booking.objects.get(id=booking_id, customer=request.user)
        except Booking.DoesNotExist:
            return Response({
                'error': 'Booking not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({
                'error': 'Session ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Retrieve the session from Stripe
            session = stripe.checkout.Session.retrieve(session_id)
            
            if session.payment_status == 'paid':
                # Update booking if not already updated
                if booking.payment_status != 'completed':
                    booking.payment_status = 'completed'
                    booking.status = 'confirmed'  # Auto-confirm booking when payment is completed
                    booking.payment_id = session.payment_intent
                    booking.payment_method = 'stripe'
                    booking.save()
                    
                    # Log booking confirmation
                    log_booking_activity(
                        booking=booking,
                        user=request.user,
                        action="CONFIRMED",
                        details={
                            'payment_method': 'stripe',
                            'session_id': session_id,
                            'payment_intent': session.payment_intent,
                            'auto_confirmed': True,
                            'reason': 'Payment verified successfully (fallback verification)'
                        },
                        request=request
                    )
                    
                    # Update transaction
                    try:
                        transaction = Transaction.objects.get(
                            booking=booking,
                            payment_provider_id=session_id
                        )
                        if transaction.status != 'completed':
                            transaction.status = 'completed'
                            transaction.payment_provider_transaction_id = session.payment_intent
                            transaction.processed_at = timezone.now()
                            transaction.save()
                    except Transaction.DoesNotExist:
                        pass
                
                return Response({
                    'success': True,
                    'message': 'Payment verified successfully',
                    'payment_status': 'completed'
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'message': 'Payment not completed',
                    'payment_status': session.payment_status
                }, status=status.HTTP_200_OK)
                
        except stripe.error.StripeError as e:
            return Response({
                'error': 'Stripe error',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
