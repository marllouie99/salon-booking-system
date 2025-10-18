from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.db import models
from django.db.models import Avg, Q
from .models import SalonApplication, Salon, Service, ServiceImage, Review
from .serializers import ReviewSerializer, ReviewCreateSerializer, SalonResponseSerializer
from activity_logger import log_user_activity, log_salon_activity
from notifications.utils import create_application_notification

User = get_user_model()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_salon_application(request):
    """Submit a new salon application"""
    try:
        data = request.data
        
        # Validate required fields
        required_fields = ['salonName', 'businessEmail', 'salonPhone', 'salonAddress', 
                          'salonCity', 'salonState', 'salonPostal', 'salonDescription',
                          'yearsInBusiness', 'staffCount', 'services']
        
        for field in required_fields:
            if not data.get(field):
                return Response({
                    'error': f'{field} is required'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user already has a pending application
        pending_application = SalonApplication.objects.filter(
            user=request.user,
            status='pending'
        ).first()
        
        if pending_application:
            return Response({
                'error': 'You already have a pending application. Please wait for admin review.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create salon application
        application = SalonApplication.objects.create(
            user=request.user,
            salon_name=data.get('salonName'),
            business_email=data.get('businessEmail'),
            phone=data.get('salonPhone'),
            website=data.get('salonWebsite', ''),
            address=data.get('salonAddress'),
            city=data.get('salonCity'),
            state=data.get('salonState'),
            postal_code=data.get('salonPostal'),
            services=data.get('services', []),
            description=data.get('salonDescription'),
            years_in_business=int(data.get('yearsInBusiness')),
            staff_count=int(data.get('staffCount')),
            application_reason=data.get('applicationReason', '')
        )
        
        # Send notification email to admin
        send_application_notification_to_admin(application)
        
        return Response({
            'message': 'Application submitted successfully! We will review and contact you soon.',
            'application_id': application.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_application(request):
    """Get current user's salon application status"""
    try:
        application = SalonApplication.objects.filter(user=request.user).order_by('-created_at').first()
        
        if not application:
            return Response({
                'has_application': False,
                'application': None
            }, status=status.HTTP_200_OK)
        
        return Response({
            'has_application': True,
            'application': {
                'id': application.id,
                'salon_name': application.salon_name,
                'business_email': application.business_email,
                'phone': application.phone,
                'website': application.website,
                'address': application.address,
                'city': application.city,
                'state': application.state,
                'postal_code': application.postal_code,
                'services': application.services,
                'description': application.description,
                'years_in_business': application.years_in_business,
                'staff_count': application.staff_count,
                'application_reason': application.application_reason,
                'status': application.status,
                'admin_notes': application.admin_notes,
                'reviewed_at': application.reviewed_at,
                'created_at': application.created_at,
                'updated_at': application.updated_at
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_applications(request):
    """Get all salon applications (Admin only)"""
    try:
        # Check if user is admin
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({
                'error': 'Admin privileges required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        applications = SalonApplication.objects.all().select_related('user', 'reviewed_by')
        
        applications_data = []
        for app in applications:
            applications_data.append({
                'id': app.id,
                'salon_name': app.salon_name,
                'business_email': app.business_email,
                'phone': app.phone,
                'website': app.website,
                'address': app.address,
                'city': app.city,
                'state': app.state,
                'postal_code': app.postal_code,
                'services': app.services,
                'description': app.description,
                'years_in_business': app.years_in_business,
                'staff_count': app.staff_count,
                'application_reason': app.application_reason,
                'status': app.status,
                'admin_notes': app.admin_notes,
                'applicant': {
                    'id': app.user.id,
                    'name': f"{app.user.first_name} {app.user.last_name}",
                    'email': app.user.email,
                },
                'reviewed_by': {
                    'id': app.reviewed_by.id,
                    'name': f"{app.reviewed_by.first_name} {app.reviewed_by.last_name}"
                } if app.reviewed_by else None,
                'reviewed_at': app.reviewed_at,
                'created_at': app.created_at,
                'updated_at': app.updated_at
            })
        
        return Response(applications_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_application(request, application_id):
    """Approve a salon application (Admin only)"""
    try:
        # Check if user is admin
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({
                'error': 'Admin privileges required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get application
        try:
            application = SalonApplication.objects.get(id=application_id)
        except SalonApplication.DoesNotExist:
            return Response({
                'error': 'Application not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already processed
        if application.status != 'pending':
            return Response({
                'error': f'Application already {application.status}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update application status
        application.status = 'approved'
        application.reviewed_by = request.user
        application.reviewed_at = timezone.now()
        application.admin_notes = request.data.get('notes', '')
        application.save()
        
        # Create salon from application
        salon = Salon.objects.create(
            owner=application.user,
            application=application,
            name=application.salon_name,
            email=application.business_email,
            phone=application.phone,
            website=application.website,
            address=application.address,
            city=application.city,
            state=application.state,
            postal_code=application.postal_code,
            description=application.description,
            services=application.services,
            years_in_business=application.years_in_business,
            staff_count=application.staff_count,
            is_verified=True
        )
        
        # Update user type to salon_owner
        application.user.user_type = 'salon_owner'
        application.user.save()
        
        # Send approval email to applicant
        send_approval_email(application, salon)
        
        # Create notification for applicant
        create_application_notification(application)
        
        return Response({
            'message': 'Application approved successfully',
            'salon_id': salon.id
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_application(request, application_id):
    """Reject a salon application (Admin only)"""
    try:
        # Check if user is admin
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({
                'error': 'Admin privileges required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get application
        try:
            application = SalonApplication.objects.get(id=application_id)
        except SalonApplication.DoesNotExist:
            return Response({
                'error': 'Application not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already processed
        if application.status != 'pending':
            return Response({
                'error': f'Application already {application.status}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update application status
        application.status = 'rejected'
        application.reviewed_by = request.user
        application.reviewed_at = timezone.now()
        application.admin_notes = request.data.get('notes', '')
        application.save()
        
        # Send rejection email to applicant
        send_rejection_email(application)
        
        # Create notification for applicant
        create_application_notification(application)
        
        return Response({
            'message': 'Application rejected'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Email notification functions
def send_application_notification_to_admin(application):
    """Send email to admin when new application is submitted"""
    subject = f'New Salon Application - {application.salon_name}'
    message = f"""
New salon application received!

Salon Name: {application.salon_name}
Applicant: {application.user.first_name} {application.user.last_name}
Email: {application.user.email}
Business Email: {application.business_email}
Phone: {application.phone}
City: {application.city}, {application.state}

Description: {application.description}

Please review the application in the admin dashboard.
    """
    
    from_email = settings.DEFAULT_FROM_EMAIL
    # Send to all admin users
    admin_emails = User.objects.filter(is_staff=True).values_list('email', flat=True)
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=list(admin_emails),
            fail_silently=False,
        )
    except Exception as e:
        print(f"Failed to send admin notification: {e}")


def send_approval_email(application, salon):
    """Send approval email to applicant"""
    subject = f'Congratulations! Your Salon Application has been Approved'
    message = f"""
Dear {application.user.first_name},

Congratulations! We are pleased to inform you that your salon application for "{application.salon_name}" has been approved!

You can now access your salon management dashboard to:
- Add and manage services
- Set up your salon profile
- Start accepting bookings
- Manage appointments

Your salon is now live on our platform and customers can start booking appointments.

Salon Details:
- Name: {salon.name}
- Location: {salon.city}, {salon.state}
- Services: {', '.join(salon.services)}

Login to your account to get started: http://localhost:3000/login

If you have any questions, feel free to contact us.

Best regards,
SalonBook Team
    """
    
    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [application.user.email, application.business_email]
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Failed to send approval email: {e}")


def send_rejection_email(application):
    """Send rejection email to applicant"""
    subject = f'Salon Application Update - {application.salon_name}'
    message = f"""
Dear {application.user.first_name},

Thank you for your interest in joining SalonBook.

After careful review, we regret to inform you that we are unable to approve your salon application at this time.

{f'Admin Notes: {application.admin_notes}' if application.admin_notes else ''}

You are welcome to submit a new application after addressing any concerns or after 30 days.

If you have any questions or would like more information, please contact us.

Best regards,
SalonBook Team
    """
    
    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [application.user.email]
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Failed to send rejection email: {e}")


@api_view(['GET'])
@permission_classes([AllowAny])
def get_all_salons(request):
    """Get all active salons"""
    try:
        salons = Salon.objects.filter(is_active=True).select_related('owner')
        
        salons_data = []
        for salon in salons:
            # Get actual services from Service model
            services = salon.salon_services.filter(is_active=True)
            services_list = [service.name for service in services]
            
            # If no services in Service model, use the JSON field as fallback
            if not services_list and salon.services:
                services_list = salon.services
            
            # Calculate price range from services
            price_range = {}
            if services:
                prices = [float(service.price) for service in services]
                price_range = {
                    'min': min(prices),
                    'max': max(prices)
                }
            
            salons_data.append({
                'id': salon.id,
                'owner_id': salon.owner.id,
                'name': salon.name,
                'email': salon.email,
                'phone': salon.phone,
                'website': salon.website,
                'address': salon.address,
                'city': salon.city,
                'state': salon.state,
                'postal_code': salon.postal_code,
                'description': salon.description,
                'logo': salon.logo.url if salon.logo else None,
                'cover_image': salon.cover_image.url if salon.cover_image else None,
                'services': services_list,
                'services_detailed': [
                    {
                        'id': service.id,
                        'name': service.name,
                        'price': float(service.price),
                        'duration': service.duration
                    } for service in services
                ],
                'price_range': price_range,
                'rating': float(salon.rating),
                'total_reviews': salon.total_reviews,
                'years_in_business': salon.years_in_business,
                'staff_count': salon.staff_count,
                'is_featured': salon.is_featured,
                'is_verified': salon.is_verified,
                'is_active': salon.is_active,
                'created_at': salon.created_at
            })
        
        return Response(salons_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Service Management Views
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_services(request):
    """Get all services for a salon or create a new service"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
            # Get all services for this salon
            services = Service.objects.filter(salon=salon)
            
            services_data = []
            for service in services:
                # Get service images
                images = service.images.all()
                image_urls = [request.build_absolute_uri(img.image.url) for img in images]
                
                services_data.append({
                    'id': service.id,
                    'name': service.name,
                    'description': service.description,
                    'price': float(service.price),
                    'duration': service.duration,
                    'is_active': service.is_active,
                    'images': image_urls,
                    'created_at': service.created_at,
                    'updated_at': service.updated_at
                })
            
            return Response(services_data, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            # Create new service
            data = request.data
            
            # Validate required fields
            required_fields = ['name', 'description', 'price', 'duration']
            for field in required_fields:
                if not data.get(field):
                    return Response({
                        'error': f'{field} is required'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create service
            service = Service.objects.create(
                salon=salon,
                name=data.get('name'),
                description=data.get('description'),
                price=data.get('price'),
                duration=data.get('duration')
            )
            
            # Handle image uploads
            images = request.FILES.getlist('images')
            image_urls = []
            for idx, image in enumerate(images):
                service_image = ServiceImage.objects.create(
                    service=service,
                    image=image,
                    is_primary=(idx == 0)  # First image is primary
                )
                image_urls.append(request.build_absolute_uri(service_image.image.url))
            
            # Log activity
            log_salon_activity(
                salon=salon,
                user=request.user,
                action='service_created',
                details=f'Created service: {service.name}'
            )
            
            return Response({
                'message': 'Service created successfully',
                'service': {
                    'id': service.id,
                    'name': service.name,
                    'description': service.description,
                    'price': float(service.price),
                    'duration': service.duration,
                    'is_active': service.is_active,
                    'images': image_urls
                }
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_service(request, service_id):
    """Edit or delete a service"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get service
        try:
            service = Service.objects.get(id=service_id, salon=salon)
        except Service.DoesNotExist:
            return Response({
                'error': 'Service not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'PUT':
            # Update service
            data = request.data
            
            service.name = data.get('name', service.name)
            service.description = data.get('description', service.description)
            service.price = data.get('price', service.price)
            service.duration = data.get('duration', service.duration)
            service.save()
            
            # Handle new images if provided
            new_images = request.FILES.getlist('images')
            if new_images:
                # Optionally delete old images
                if data.get('replace_images') == 'true':
                    service.images.all().delete()
                
                # Add new images
                for idx, image in enumerate(new_images):
                    ServiceImage.objects.create(
                        service=service,
                        image=image,
                        is_primary=(idx == 0 and not service.images.exists())
                    )
            
            # Get updated images
            images = service.images.all()
            image_urls = [request.build_absolute_uri(img.image.url) for img in images]
            
            # Log activity
            log_salon_activity(
                salon=salon,
                user=request.user,
                action='service_updated',
                details=f'Updated service: {service.name}'
            )
            
            return Response({
                'message': 'Service updated successfully',
                'service': {
                    'id': service.id,
                    'name': service.name,
                    'description': service.description,
                    'price': float(service.price),
                    'duration': service.duration,
                    'is_active': service.is_active,
                    'images': image_urls
                }
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'DELETE':
            service_name = service.name
            service.delete()
            
            # Log activity
            log_salon_activity(
                salon=salon,
                user=request.user,
                action='service_deleted',
                details=f'Deleted service: {service_name}'
            )
            
            return Response({
                'message': 'Service deleted successfully'
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_salon_services(request, salon_id):
    """Get all services for a specific salon (public)"""
    try:
        # Get salon
        try:
            salon = Salon.objects.get(id=salon_id)
        except Salon.DoesNotExist:
            return Response({
                'error': 'Salon not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get all active services for this salon
        services = Service.objects.filter(salon=salon, is_active=True)
        
        services_data = []
        for service in services:
            # Get service images
            images = service.images.all()
            image_urls = [request.build_absolute_uri(img.image.url) for img in images]
            
            services_data.append({
                'id': service.id,
                'name': service.name,
                'description': service.description,
                'price': float(service.price),
                'duration': service.duration,
                'images': image_urls,
            })
        
        return Response(services_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_service(request, service_id):
    """Update or delete a specific service"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get service
        try:
            service = Service.objects.get(id=service_id, salon=salon)
        except Service.DoesNotExist:
            return Response({
                'error': 'Service not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'PUT':
            # Update service
            data = request.data
            
            service.name = data.get('name', service.name)
            service.description = data.get('description', service.description)
            service.price = data.get('price', service.price)
            service.duration = data.get('duration', service.duration)
            service.is_active = data.get('is_active', service.is_active)
            service.save()
            
            return Response({
                'message': 'Service updated successfully',
                'service': {
                    'id': service.id,
                    'name': service.name,
                    'description': service.description,
                    'price': float(service.price),
                    'duration': service.duration,
                    'is_active': service.is_active
                }
            }, status=status.HTTP_200_OK)
        
        elif request.method == 'DELETE':
            # Delete service
            service.delete()
            
            return Response({
                'message': 'Service deleted successfully'
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Search and Filtering Views

@api_view(['GET'])
@permission_classes([AllowAny])
def search_salons(request):
    """Search salons by name, city, or services"""
    try:
        query = request.GET.get('q', '').strip()
        
        if not query:
            return Response({
                'error': 'Search query is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Search in salon name, city, and services
        salons = Salon.objects.filter(
            is_active=True
        ).filter(
            models.Q(name__icontains=query) |
            models.Q(city__icontains=query) |
            models.Q(description__icontains=query) |
            models.Q(salon_services__name__icontains=query)
        ).distinct()
        
        # Also search for individual services that match
        services = Service.objects.filter(
            is_active=True,
            salon__is_active=True
        ).filter(
            models.Q(name__icontains=query) |
            models.Q(description__icontains=query)
        ).select_related('salon')
        
        # Serialize salon data
        salons_data = []
        for salon in salons:
            services_for_salon = salon.salon_services.filter(is_active=True)
            salons_data.append({
                'id': salon.id,
                'name': salon.name,
                'city': salon.city,
                'address': salon.address,
                'phone': salon.phone,
                'rating': float(salon.rating),
                'total_reviews': salon.total_reviews,
                'description': salon.description,
                'is_verified': salon.is_verified,
                'services': [
                    {
                        'id': service.id,
                        'name': service.name,
                        'price': float(service.price),
                        'duration': service.duration
                    } for service in services_for_salon
                ]
            })
        
        # Serialize individual service data
        services_data = []
        for service in services:
            services_data.append({
                'id': service.id,
                'name': service.name,
                'description': service.description,
                'price': float(service.price),
                'duration': service.duration,
                'salon': {
                    'id': service.salon.id,
                    'name': service.salon.name,
                    'city': service.salon.city,
                    'address': service.salon.address,
                    'rating': float(service.salon.rating),
                    'total_reviews': service.salon.total_reviews,
                    'is_verified': service.salon.is_verified
                }
            })
        
        return Response({
            'query': query,
            'salon_count': len(salons_data),
            'service_count': len(services_data),
            'total_count': len(salons_data) + len(services_data),
            'salons': salons_data,
            'services': services_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def filter_salons(request):
    """Filter salons by various criteria"""
    try:
        # Get filter parameters
        city = request.GET.get('city', '').strip()
        min_rating = request.GET.get('min_rating')
        max_price = request.GET.get('max_price')
        min_price = request.GET.get('min_price')
        service_name = request.GET.get('service', '').strip()
        verified_only = request.GET.get('verified', '').lower() == 'true'
        sort_by = request.GET.get('sort', 'name')  # name, rating, reviews
        
        # Start with active salons
        salons = Salon.objects.filter(is_active=True)
        
        # Apply filters
        if city:
            salons = salons.filter(city__icontains=city)
            
        if min_rating:
            try:
                min_rating = float(min_rating)
                salons = salons.filter(rating__gte=min_rating)
            except ValueError:
                pass
                
        if verified_only:
            salons = salons.filter(is_verified=True)
            
        if service_name:
            salons = salons.filter(salon_services__name__icontains=service_name).distinct()
            
        # Price filtering (based on services)
        if min_price or max_price:
            if min_price:
                try:
                    min_price = float(min_price)
                    salons = salons.filter(salon_services__price__gte=min_price).distinct()
                except ValueError:
                    pass
                    
            if max_price:
                try:
                    max_price = float(max_price)
                    salons = salons.filter(salon_services__price__lte=max_price).distinct()
                except ValueError:
                    pass
        
        # Apply sorting
        if sort_by == 'rating':
            salons = salons.order_by('-rating', '-total_reviews')
        elif sort_by == 'reviews':
            salons = salons.order_by('-total_reviews', '-rating')
        else:  # name
            salons = salons.order_by('name')
        
        # Serialize salon data
        salons_data = []
        for salon in salons:
            services = salon.salon_services.filter(is_active=True)
            price_range = {
                'min': float(services.aggregate(models.Min('price'))['price__min'] or 0),
                'max': float(services.aggregate(models.Max('price'))['price__max'] or 0)
            }
            
            salons_data.append({
                'id': salon.id,
                'name': salon.name,
                'city': salon.city,
                'address': salon.address,
                'phone': salon.phone,
                'rating': float(salon.rating),
                'total_reviews': salon.total_reviews,
                'description': salon.description,
                'is_verified': salon.is_verified,
                'price_range': price_range,
                'services_count': services.count(),
                'services': [
                    {
                        'id': service.id,
                        'name': service.name,
                        'price': float(service.price),
                        'duration': service.duration
                    } for service in services[:3]  # Show only first 3 services
                ]
            })
        
        # Get filter statistics
        all_salons = Salon.objects.filter(is_active=True)
        cities = list(all_salons.values_list('city', flat=True).distinct())
        
        return Response({
            'filters_applied': {
                'city': city,
                'min_rating': min_rating,
                'max_price': max_price,
                'min_price': min_price,
                'service': service_name,
                'verified_only': verified_only,
                'sort_by': sort_by
            },
            'count': len(salons_data),
            'salons': salons_data,
            'available_filters': {
                'cities': sorted(cities),
                'ratings': [1, 2, 3, 4, 5],
                'sort_options': ['name', 'rating', 'reviews']
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def nearby_salons(request):
    """Find salons near a given location"""
    try:
        # Get location parameters
        lat = request.GET.get('lat')
        lng = request.GET.get('lng')
        radius = request.GET.get('radius', '10')  # Default 10km
        
        if not lat or not lng:
            return Response({
                'error': 'Latitude and longitude are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            lat = float(lat)
            lng = float(lng)
            radius = float(radius)
        except ValueError:
            return Response({
                'error': 'Invalid coordinates or radius'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all active salons with coordinates
        salons = Salon.objects.filter(
            is_active=True,
            latitude__isnull=False,
            longitude__isnull=False
        )
        
        # Calculate distance and filter
        nearby_salons = []
        for salon in salons:
            salon_lat = float(salon.latitude)
            salon_lng = float(salon.longitude)
            
            # Calculate distance using Haversine formula (simplified)
            distance = calculate_distance(lat, lng, salon_lat, salon_lng)
            
            if distance <= radius:
                services = salon.salon_services.filter(is_active=True)
                nearby_salons.append({
                    'id': salon.id,
                    'name': salon.name,
                    'city': salon.city,
                    'address': salon.address,
                    'phone': salon.phone,
                    'rating': float(salon.rating),
                    'total_reviews': salon.total_reviews,
                    'description': salon.description,
                    'is_verified': salon.is_verified,
                    'distance': round(distance, 2),
                    'coordinates': {
                        'lat': salon_lat,
                        'lng': salon_lng
                    },
                    'services_count': services.count(),
                    'services': [
                        {
                            'id': service.id,
                            'name': service.name,
                            'price': float(service.price),
                            'duration': service.duration
                        } for service in services[:3]
                    ]
                })
        
        # Sort by distance
        nearby_salons.sort(key=lambda x: x['distance'])
        
        return Response({
            'search_location': {
                'lat': lat,
                'lng': lng,
                'radius': radius
            },
            'count': len(nearby_salons),
            'salons': nearby_salons
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def calculate_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points using Haversine formula"""
    import math
    
    # Convert to radians
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Earth radius in km
    r = 6371
    
    return c * r


# ============================================
# REVIEW API ENDPOINTS
# ============================================

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def salon_reviews(request, salon_id):
    """Get all reviews for a salon or create a new review"""
    try:
        salon = Salon.objects.get(id=salon_id)
    except Salon.DoesNotExist:
        return Response({'error': 'Salon not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # GET: List reviews for the salon
    if request.method == 'GET':
        # Salon owners see all reviews (including pending), public sees only approved
        is_salon_owner = request.user.is_authenticated and salon.owner == request.user
        
        print(f"DEBUG: Fetching reviews for salon_id={salon_id}, salon={salon.name}")
        print(f"DEBUG: User authenticated={request.user.is_authenticated}, is_salon_owner={is_salon_owner}")
        
        if is_salon_owner:
            # Salon owner sees all reviews
            reviews = Review.objects.filter(
                salon=salon
            ).select_related('customer', 'booking').order_by('-created_at')
            print(f"DEBUG: Salon owner - found {reviews.count()} reviews")
        else:
            # Public sees only approved reviews
            reviews = Review.objects.filter(
                salon=salon,
                status='approved'
            ).select_related('customer', 'booking').order_by('-created_at')
            print(f"DEBUG: Public - found {reviews.count()} approved reviews")
        
        # Debug: Show all reviews in database for this salon
        all_reviews = Review.objects.filter(salon=salon)
        print(f"DEBUG: Total reviews in DB for this salon: {all_reviews.count()}")
        for r in all_reviews:
            print(f"  - Review ID={r.id}, Customer={r.customer.email}, Rating={r.rating}, Status={r.status}")
        
        # Filter by rating if provided
        rating_filter = request.GET.get('rating')
        if rating_filter:
            reviews = reviews.filter(rating=int(rating_filter))
        
        # Pagination
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size
        
        total_reviews = reviews.count()
        reviews_page = reviews[start:end]
        
        serializer = ReviewSerializer(reviews_page, many=True, context={'request': request})
        
        # Get rating breakdown
        rating_breakdown = {
            '5': reviews.filter(rating=5).count(),
            '4': reviews.filter(rating=4).count(),
            '3': reviews.filter(rating=3).count(),
            '2': reviews.filter(rating=2).count(),
            '1': reviews.filter(rating=1).count(),
        }
        
        return Response({
            'reviews': serializer.data,
            'total': total_reviews,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_reviews + page_size - 1) // page_size,
            'average_rating': float(salon.rating),
            'rating_breakdown': rating_breakdown
        }, status=status.HTTP_200_OK)
    
    # POST: Create a new review
    elif request.method == 'POST':
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        serializer = ReviewCreateSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            review = serializer.save()
            
            # Log activity
            log_user_activity(request.user, 'REVIEW_CREATED', f'Created review for {salon.name}')
            
            return Response({
                'message': 'Review submitted successfully! It will be visible after admin approval.',
                'review': ReviewSerializer(review, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def review_detail(request, review_id):
    """Get, update, or delete a specific review"""
    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return Response({'error': 'Review not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    is_owner = review.customer == request.user
    is_salon_owner = review.salon.owner == request.user
    is_admin = request.user.is_staff or request.user.is_superuser
    
    # GET: Retrieve review details
    if request.method == 'GET':
        if review.status != 'approved' and not (is_owner or is_salon_owner or is_admin):
            return Response({'error': 'Review not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ReviewSerializer(review, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    # PUT: Update review (customer only)
    elif request.method == 'PUT':
        if not is_owner:
            return Response({'error': 'You can only edit your own reviews'}, status=status.HTTP_403_FORBIDDEN)
        
        # Only allow editing if review hasn't been approved yet or within 24 hours
        if review.status == 'approved':
            time_since_creation = timezone.now() - review.created_at
            if time_since_creation.total_seconds() > 86400:  # 24 hours
                return Response({
                    'error': 'You can only edit approved reviews within 24 hours of creation'
                }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = ReviewSerializer(review, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            # Reset status to pending if review was approved
            if review.status == 'approved':
                review.status = 'pending'
            serializer.save()
            
            log_user_activity(request.user, 'REVIEW_UPDATED', f'Updated review for {review.salon.name}')
            
            return Response({
                'message': 'Review updated successfully',
                'review': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # DELETE: Delete review (customer or admin only)
    elif request.method == 'DELETE':
        if not (is_owner or is_admin):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        salon_name = review.salon.name
        review.delete()
        
        log_user_activity(request.user, 'REVIEW_DELETED', f'Deleted review for {salon_name}')
        
        return Response({
            'message': 'Review deleted successfully'
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_to_review(request, review_id):
    """Salon owner responds to a review"""
    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return Response({'error': 'Review not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if user is the salon owner
    if review.salon.owner != request.user and not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Only salon owners can respond to reviews'}, status=status.HTTP_403_FORBIDDEN)
    
    serializer = SalonResponseSerializer(data=request.data)
    if serializer.is_valid():
        review.salon_response = serializer.validated_data['salon_response']
        review.salon_response_date = timezone.now()
        review.save()
        
        log_salon_activity(review.salon, request.user, 'REVIEW_RESPONSE', f'Responded to review from {review.customer.email}')
        
        return Response({
            'message': 'Response added successfully',
            'review': ReviewSerializer(review, context={'request': request}).data
        }, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_review_helpful(request, review_id):
    """Mark a review as helpful"""
    try:
        review = Review.objects.get(id=review_id, status='approved')
    except Review.DoesNotExist:
        return Response({'error': 'Review not found'}, status=status.HTTP_404_NOT_FOUND)
    
    review.helpful_count += 1
    review.save()
    
    return Response({
        'message': 'Thank you for your feedback',
        'helpful_count': review.helpful_count
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_reviews(request):
    """Get all reviews created by the current user"""
    reviews = Review.objects.filter(customer=request.user).select_related('salon', 'booking')
    
    serializer = ReviewSerializer(reviews, many=True, context={'request': request})
    
    return Response({
        'reviews': serializer.data,
        'total': reviews.count()
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_reviews(request):
    """Get reviews pending moderation (Admin only)"""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin privileges required'}, status=status.HTTP_403_FORBIDDEN)
    
    reviews = Review.objects.filter(status='pending').select_related('customer', 'salon', 'booking')
    
    serializer = ReviewSerializer(reviews, many=True, context={'request': request})
    
    return Response({
        'reviews': serializer.data,
        'total': reviews.count()
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def moderate_review(request, review_id):
    """Approve or reject a review (Admin only)"""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Admin privileges required'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        return Response({'error': 'Review not found'}, status=status.HTTP_404_NOT_FOUND)
    
    action = request.data.get('action')  # 'approve' or 'reject'
    notes = request.data.get('notes', '')
    
    if action not in ['approve', 'reject']:
        return Response({'error': 'Invalid action. Use "approve" or "reject"'}, status=status.HTTP_400_BAD_REQUEST)
    
    review.status = 'approved' if action == 'approve' else 'rejected'
    review.moderated_by = request.user
    review.moderation_notes = notes
    review.save()
    
    return Response({
        'message': f'Review {action}d successfully',
        'review': ReviewSerializer(review, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_salon_profile(request):
    """Update salon profile information"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Update allowed fields
        data = request.data
        if 'name' in data:
            salon.name = data['name']
        if 'email' in data:
            salon.email = data['email']
        if 'phone' in data:
            salon.phone = data['phone']
        if 'website' in data:
            salon.website = data['website']
        if 'description' in data:
            salon.description = data['description']
        if 'address' in data:
            salon.address = data['address']
        if 'city' in data:
            salon.city = data['city']
        if 'state' in data:
            salon.state = data['state']
        
        salon.save()
        
        # Log activity
        log_salon_activity(
            salon=salon,
            action="SALON PROFILE UPDATED",
            details={
                'updated_fields': list(data.keys())
            },
            user=request.user
        )
        
        return Response({
            'message': 'Salon profile updated successfully',
            'salon': {
                'id': salon.id,
                'name': salon.name,
                'email': salon.email,
                'phone': salon.phone,
                'website': salon.website,
                'description': salon.description,
                'address': salon.address,
                'city': salon.city,
                'state': salon.state,
                'postal_code': salon.postal_code
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_salon_logo(request):
    """Upload salon logo image"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if 'logo' not in request.FILES:
            return Response({
                'error': 'No logo file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logo = request.FILES['logo']
        
        # Validate file size (max 5MB)
        if logo.size > 5 * 1024 * 1024:
            return Response({
                'error': 'Logo file size must be less than 5MB'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
        if logo.content_type not in allowed_types:
            return Response({
                'error': 'Only JPEG, PNG, GIF, and WebP images are allowed'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Save logo
        salon.logo = logo
        salon.save()
        
        # Log activity
        log_salon_activity(
            salon=salon,
            user=request.user,
            action="SALON LOGO UPDATED",
            details={
                'logo_url': request.build_absolute_uri(salon.logo.url)
            }
        )
        
        return Response({
            'message': 'Logo uploaded successfully',
            'logo_url': salon.logo.url if salon.logo else None
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_salon_cover(request):
    """Upload salon cover image"""
    try:
        # Get salon owned by the user
        salon = Salon.objects.filter(owner=request.user).first()
        
        if not salon:
            return Response({
                'error': 'You do not own a salon'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if 'cover_image' not in request.FILES:
            return Response({
                'error': 'No cover image file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        cover_image = request.FILES['cover_image']
        
        # Validate file size (max 10MB)
        if cover_image.size > 10 * 1024 * 1024:
            return Response({
                'error': 'Cover image file size must be less than 10MB'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
        if cover_image.content_type not in allowed_types:
            return Response({
                'error': 'Only JPEG, PNG, GIF, and WebP images are allowed'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Save cover image
        salon.cover_image = cover_image
        salon.save()
        
        # Log activity
        log_salon_activity(
            salon=salon,
            user=request.user,
            action="SALON COVER IMAGE UPDATED",
            details={
                'cover_image_url': request.build_absolute_uri(salon.cover_image.url)
            }
        )
        
        return Response({
            'message': 'Cover image uploaded successfully',
            'cover_image_url': salon.cover_image.url if salon.cover_image else None
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
