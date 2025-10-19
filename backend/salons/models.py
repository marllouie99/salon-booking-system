from django.db import models
from django.contrib.auth import get_user_model
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


class SalonApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    # Applicant information
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salon_applications')
    
    # Salon information
    salon_name = models.CharField(max_length=255)
    business_email = models.EmailField()
    phone = models.CharField(max_length=20)
    website = models.URLField(blank=True, null=True)
    
    # Location
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    
    # Services (stored as JSON array)
    services = models.JSONField(default=list)
    
    # Details
    description = models.TextField()
    years_in_business = models.IntegerField()
    staff_count = models.IntegerField()
    application_reason = models.TextField(blank=True, null=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_applications')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Salon Application'
        verbose_name_plural = 'Salon Applications'
    
    def __str__(self):
        return f"{self.salon_name} - {self.status}"


class Salon(models.Model):
    """Model for approved salons"""
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_salons')
    application = models.OneToOneField(SalonApplication, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Basic information
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    website = models.URLField(blank=True, null=True)
    
    # Location
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # Details
    description = models.TextField()
    services = models.JSONField(default=list)
    
    # Media
    logo = models.ImageField(upload_to='salon_logos/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='salon_covers/', blank=True, null=True)
    
    # Ratings and stats
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_reviews = models.IntegerField(default=0)
    years_in_business = models.IntegerField(default=0)
    staff_count = models.IntegerField(default=0)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Salon'
        verbose_name_plural = 'Salons'
    
    def __str__(self):
        return self.name


class Service(models.Model):
    """Model for salon services"""
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='salon_services')
    
    # Service details
    name = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration = models.IntegerField(help_text='Duration in minutes')
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = 'Service'
        verbose_name_plural = 'Services'
    
    def __str__(self):
        return f"{self.salon.name} - {self.name}"


class ServiceImage(models.Model):
    """Model for service images"""
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='service_images/')
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_primary', 'created_at']
        verbose_name = 'Service Image'
        verbose_name_plural = 'Service Images'
    
    def __str__(self):
        return f"{self.service.name} - Image"


class Review(models.Model):
    """Customer reviews and ratings for salons"""
    
    RATING_CHOICES = [
        (1, '1 Star - Poor'),
        (2, '2 Stars - Fair'),
        (3, '3 Stars - Good'),
        (4, '4 Stars - Very Good'),
        (5, '5 Stars - Excellent'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    # Relationships
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='reviews')
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    booking = models.OneToOneField('bookings.Booking', on_delete=models.SET_NULL, null=True, blank=True, related_name='review')
    
    # Review details
    rating = models.IntegerField(choices=RATING_CHOICES)
    title = models.CharField(max_length=200, blank=True, help_text='Optional review title')
    comment = models.TextField(help_text='Review comment')
    
    # Additional ratings (optional)
    service_quality = models.IntegerField(choices=RATING_CHOICES, null=True, blank=True)
    cleanliness = models.IntegerField(choices=RATING_CHOICES, null=True, blank=True)
    value_for_money = models.IntegerField(choices=RATING_CHOICES, null=True, blank=True)
    staff_friendliness = models.IntegerField(choices=RATING_CHOICES, null=True, blank=True)
    
    # Moderation
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    is_verified_booking = models.BooleanField(default=False, help_text='Review from verified booking')
    moderated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='moderated_reviews')
    moderation_notes = models.TextField(blank=True, null=True)
    
    # Engagement
    helpful_count = models.IntegerField(default=0, help_text='Number of users who found this helpful')
    
    # Salon response
    salon_response = models.TextField(blank=True, null=True, help_text='Salon owner response to review')
    salon_response_date = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Review'
        verbose_name_plural = 'Reviews'
        unique_together = ['customer', 'salon', 'booking']
        indexes = [
            models.Index(fields=['salon', 'status', '-created_at']),
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['rating']),
        ]
    
    def __str__(self):
        return f"{self.customer.email} - {self.salon.name} ({self.rating} stars)"
    
    def save(self, *args, **kwargs):
        # Mark as verified if linked to a completed booking
        if self.booking and self.booking.status == 'completed':
            self.is_verified_booking = True
        
        # Auto-approve 5-star verified reviews (optional feature)
        if self.rating == 5 and self.is_verified_booking and self.status == 'pending':
            self.status = 'approved'
        
        is_new = self.pk is None
        
        super().save(*args, **kwargs)
        
        # Update salon's average rating and review count
        self.update_salon_rating()
        
        # Send email notification if new review
        if is_new:
            self.send_review_notification()
    
    def update_salon_rating(self):
        """Update the salon's average rating and total reviews"""
        from django.db.models import Avg, Count
        
        approved_reviews = Review.objects.filter(
            salon=self.salon,
            status='approved'
        )
        
        stats = approved_reviews.aggregate(
            avg_rating=Avg('rating'),
            total_reviews=Count('id')
        )
        
        self.salon.rating = round(stats['avg_rating'] or 0, 2)
        self.salon.total_reviews = stats['total_reviews'] or 0
        self.salon.save(update_fields=['rating', 'total_reviews'])
    
    def send_review_notification(self):
        """Send email notification to salon owner about new review"""
        from django.core.mail import send_mail
        from django.conf import settings
        
        subject = f'New Review for {self.salon.name}'
        
        status_text = '5-star review was automatically approved!' if self.status == 'approved' else 'review is pending moderation.'
        
        message = f"""
Hello {self.salon.owner.first_name or 'Salon Owner'},

You have received a new {self.rating}-star review for your salon "{self.salon.name}".

Customer: {self.customer.first_name} {self.customer.last_name}
Rating: {'⭐' * self.rating} ({self.rating}/5 stars)
Comment: {self.comment[:200]}{'...' if len(self.comment) > 200 else ''}

Status: {status_text}

{f'Booking: #{self.booking.id}' if self.booking else 'General review (not linked to booking)'}

You can respond to this review by logging into your salon dashboard:
http://localhost:3000/salon/dashboard

Thank you for being part of our platform!

Best regards,
SalonBook Team
        """
        
        logger.info(f"📧 Attempting to send review notification to: {self.salon.owner.email}")
        print(f"📧 Attempting to send review notification to: {self.salon.owner.email}")
        
        try:
            # Use Brevo API if available
            brevo_api_key = getattr(settings, 'BREVO_API_KEY', None)
            
            if brevo_api_key and BREVO_SDK_AVAILABLE:
                try:
                    configuration = sib_api_v3_sdk.Configuration()
                    configuration.api_key['api-key'] = brevo_api_key
                    
                    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                    
                    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                        to=[{"email": self.salon.owner.email, "name": self.salon.owner.first_name or 'Salon Owner'}],
                        sender={"email": settings.DEFAULT_FROM_EMAIL, "name": "Salon Booking System"},
                        subject=subject,
                        text_content=message
                    )
                    
                    api_response = api_instance.send_transac_email(send_smtp_email)
                    logger.info(f"✅ Review notification SENT via Brevo API - Message ID: {api_response.message_id}")
                    print(f"✅ Review notification SENT via Brevo API")
                    return
                    
                except ApiException as e:
                    logger.error(f"❌ Brevo API error: {e}")
                    print(f"❌ Brevo API error: {e}")
                    # Fall through to SMTP fallback
            
            # Fallback to SMTP
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [self.salon.owner.email],
                fail_silently=True,
            )
            logger.info(f"✅ Review notification SENT via SMTP")
            print(f"✅ Review notification SENT via SMTP")
            
        except Exception as e:
            logger.error(f"❌ Error sending review notification: {e}", exc_info=True)
            print(f'❌ Error sending review notification: {e}')
