"""
Utility functions for creating notifications
"""
from .models import Notification


def create_application_notification(application):
    """
    Create notification when salon application status changes
    
    Args:
        application: SalonApplication instance
    """
    user = application.user
    
    if application.status == 'approved':
        Notification.create_notification(
            user=user,
            notification_type='application_approved',
            title='🎉 Salon Application Approved!',
            message=f'Congratulations! Your salon "{application.salon_name}" has been approved!',
            action_url='/salon-owner-dashboard.html',
            related_object=application,
            metadata={
                'application_id': application.id,
                'salon_name': application.salon_name,
                'status': application.status
            }
        )
    
    elif application.status == 'rejected':
        Notification.create_notification(
            user=user,
            notification_type='application_rejected',
            title='Application Not Approved',
            message=f'Your salon application "{application.salon_name}" was not approved.',
            action_url='/salon-application-status.html',
            related_object=application,
            metadata={
                'application_id': application.id,
                'salon_name': application.salon_name,
                'status': application.status,
                'admin_notes': application.admin_notes or ''
            }
        )


def create_booking_notification(booking, notification_type):
    """
    Create notification for booking events
    
    Args:
        booking: Booking instance
        notification_type: Type of booking notification
    """
    customer = booking.customer
    
    notifications_map = {
        'confirmed': {
            'title': 'Booking Confirmed',
            'message': f'Your booking at {booking.salon.name} on {booking.booking_date} has been confirmed!',
            'action_url': '/my-bookings.html'
        },
        'cancelled': {
            'title': 'Booking Cancelled',
            'message': f'Your booking at {booking.salon.name} on {booking.booking_date} has been cancelled.',
            'action_url': '/my-bookings.html'
        },
        'completed': {
            'title': 'Booking Completed',
            'message': f'Your booking at {booking.salon.name} is complete. Please leave a review!',
            'action_url': f'/reviews.html?salon_id={booking.salon.id}'
        },
        'reminder': {
            'title': 'Booking Reminder',
            'message': f'Reminder: You have a booking at {booking.salon.name} on {booking.booking_date} at {booking.booking_time}',
            'action_url': '/my-bookings.html'
        }
    }
    
    if notification_type in notifications_map:
        notif_data = notifications_map[notification_type]
        Notification.create_notification(
            user=customer,
            notification_type=f'booking_{notification_type}',
            title=notif_data['title'],
            message=notif_data['message'],
            action_url=notif_data['action_url'],
            related_object=booking,
            metadata={
                'booking_id': booking.id,
                'salon_name': booking.salon.name,
                'booking_date': str(booking.booking_date),
                'booking_time': str(booking.booking_time)
            }
        )


def create_review_notification(review):
    """
    Create notification when salon receives a review
    
    Args:
        review: Review instance
    """
    salon_owner = review.salon.owner
    
    Notification.create_notification(
        user=salon_owner,
        notification_type='review_received',
        title='New Review Received',
        message=f'{review.customer.first_name or "A customer"} left a {review.rating}-star review for {review.salon.name}',
        action_url='/salon-owner-dashboard.html',
        related_object=review,
        metadata={
            'review_id': review.id,
            'salon_name': review.salon.name,
            'rating': review.rating,
            'customer_name': f'{review.customer.first_name} {review.customer.last_name}'
        }
    )


def create_message_notification(message, recipient):
    """
    Create notification for new chat message
    
    Args:
        message: Message instance
        recipient: User who should receive the notification
    """
    sender_type = 'salon' if message.sender_type == 'customer' else 'customer'
    sender_name = message.chat.salon.name if message.sender_type == 'salon' else message.chat.customer.get_full_name()
    
    Notification.create_notification(
        user=recipient,
        notification_type='message_received',
        title='New Message',
        message=f'You have a new message from {sender_name}',
        action_url='/chat.html',
        related_object=message,
        metadata={
            'chat_id': message.chat.id,
            'sender_type': message.sender_type,
            'message_preview': message.content[:50]
        }
    )
