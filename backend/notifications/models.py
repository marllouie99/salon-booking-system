from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()


class Notification(models.Model):
    """
    Notification model for user notifications
    Supports different notification types and can link to any model using GenericForeignKey
    """
    
    NOTIFICATION_TYPES = [
        ('application_approved', 'Application Approved'),
        ('application_rejected', 'Application Rejected'),
        ('application_pending', 'Application Pending'),
        ('booking_confirmed', 'Booking Confirmed'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('booking_completed', 'Booking Completed'),
        ('booking_reminder', 'Booking Reminder'),
        ('review_received', 'Review Received'),
        ('review_response', 'Review Response'),
        ('message_received', 'Message Received'),
        ('payment_success', 'Payment Success'),
        ('payment_failed', 'Payment Failed'),
        ('system', 'System Notification'),
        ('info', 'Information'),
    ]
    
    # Recipient
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    
    # Notification details
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    
    # Read status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Action URL (where to redirect when clicked)
    action_url = models.CharField(max_length=500, blank=True, null=True)
    
    # Generic relation to any model (optional)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True, help_text='Additional notification data')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
            models.Index(fields=['user', 'notification_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.title}"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            from django.utils import timezone
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
    
    @classmethod
    def create_notification(cls, user, notification_type, title, message, action_url=None, related_object=None, metadata=None):
        """
        Helper method to create a notification
        
        Args:
            user: User instance
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            action_url: Optional URL to redirect when clicked
            related_object: Optional related model instance
            metadata: Optional additional data
        """
        notification = cls(
            user=user,
            notification_type=notification_type,
            title=title,
            message=message,
            action_url=action_url,
            metadata=metadata or {}
        )
        
        if related_object:
            notification.related_object = related_object
        
        notification.save()
        return notification
