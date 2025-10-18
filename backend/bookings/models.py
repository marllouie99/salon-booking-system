from django.db import models
from django.contrib.auth import get_user_model
from salons.models import Salon, Service

User = get_user_model()


class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Relationships
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='bookings')
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='bookings')
    
    # Booking details
    booking_date = models.DateField()
    booking_time = models.TimeField()
    duration = models.IntegerField(help_text='Duration in minutes')
    
    # Customer information
    customer_name = models.CharField(max_length=200)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=20)
    notes = models.TextField(blank=True, null=True)
    
    # Status and pricing
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Payment information
    payment_status = models.CharField(max_length=20, default='pending', choices=[
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('refunded', 'Refunded'),
        ('failed', 'Failed')
    ])
    payment_method = models.CharField(max_length=20, default='paypal', choices=[
        ('paypal', 'PayPal'),
        ('stripe', 'Stripe'),
        ('pay_later', 'Pay Later at Salon'),
        ('cash', 'Cash'),
        ('card', 'Card'),
    ])
    payment_id = models.CharField(max_length=255, blank=True, null=True)
    paypal_order_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Google Calendar integration
    google_calendar_event_id = models.CharField(max_length=255, blank=True, null=True, help_text='Google Calendar event ID')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Booking'
        verbose_name_plural = 'Bookings'
    
    def __str__(self):
        return f"{self.customer_name} - {self.salon.name} on {self.booking_date}"
    
    def save(self, *args, **kwargs):
        """
        Auto-complete payment when booking is marked as completed
        and payment method is 'pay_later'
        """
        # Check if status changed to completed
        if self.pk:  # Only for existing bookings
            try:
                old_booking = Booking.objects.get(pk=self.pk)
                # If status changed to completed and payment is pending with pay_later method
                if (old_booking.status != 'completed' and 
                    self.status == 'completed' and 
                    self.payment_status == 'pending' and
                    self.payment_method == 'pay_later'):
                    
                    # Auto-complete payment
                    self.payment_status = 'completed'
                    
                    # Update associated transaction if exists
                    try:
                        transaction = Transaction.objects.get(booking=self)
                        transaction.status = 'completed'
                        transaction.payment_method = 'cash'  # Assume cash payment at salon
                        transaction.processed_at = models.functions.Now()
                        transaction.save()
                    except Transaction.DoesNotExist:
                        pass
            except Booking.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)
    
    @property
    def total_amount(self):
        """Calculate total amount including any additional fees"""
        return self.price


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('payment', 'Payment'),
        ('refund', 'Refund'),
        ('partial_refund', 'Partial Refund'),
        ('fee', 'Platform Fee'),
        ('payout', 'Salon Payout'),
    ]
    
    PAYMENT_METHODS = [
        ('paypal', 'PayPal'),
        ('pay_later', 'Pay Later at Salon'),
        ('cash', 'Cash'),
        ('stripe', 'Stripe'),
        ('bank_transfer', 'Bank Transfer'),
        ('credit_card', 'Credit Card'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    ]
    
    # Core fields
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='transactions')
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    salon = models.ForeignKey(Salon, on_delete=models.CASCADE, related_name='transactions')
    
    # Transaction details
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default='payment')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='PHP')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Payment provider details
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='paypal')
    payment_provider_id = models.CharField(max_length=255, blank=True, null=True, help_text='PayPal Order ID, Stripe Payment Intent ID, etc.')
    payment_provider_transaction_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Additional details
    description = models.TextField(blank=True, null=True)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    salon_payout = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True, help_text='Additional transaction data')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['customer', 'created_at']),
            models.Index(fields=['salon', 'created_at']),
            models.Index(fields=['payment_provider_id']),
        ]
    
    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} {self.currency} - {self.customer.email}"
    
    @property
    def net_amount(self):
        """Amount after platform fees"""
        return self.amount - self.platform_fee
    
    def calculate_platform_fee(self, fee_percentage=0.03):
        """Calculate platform fee (default 3%)"""
        from decimal import Decimal
        fee_decimal = Decimal(str(fee_percentage))
        self.platform_fee = self.amount * fee_decimal
        self.salon_payout = self.amount - self.platform_fee
        return self.platform_fee


class Chat(models.Model):
    """Chat conversation between customer and salon"""
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customer_chats')
    salon = models.ForeignKey('salons.Salon', on_delete=models.CASCADE, related_name='salon_chats')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # Optional: Link to a specific booking for context
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name='chats')
    
    class Meta:
        unique_together = ['customer', 'salon']
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"Chat: {self.customer.email} <-> {self.salon.name}"
    
    @property
    def last_message(self):
        """Get the last message in this chat"""
        return self.messages.first()
    
    @property
    def unread_count_for_customer(self):
        """Count unread messages for customer"""
        return self.messages.filter(sender_type='salon', is_read=False).count()
    
    @property
    def unread_count_for_salon(self):
        """Count unread messages for salon"""
        return self.messages.filter(sender_type='customer', is_read=False).count()


class Message(models.Model):
    """Individual message in a chat"""
    SENDER_CHOICES = [
        ('customer', 'Customer'),
        ('salon', 'Salon'),
    ]
    
    MESSAGE_TYPES = [
        ('text', 'Text Message'),
        ('image', 'Image'),
        ('gif', 'GIF'),
        ('sticker', 'Sticker'),
        ('booking_inquiry', 'Booking Inquiry'),
        ('booking_update', 'Booking Update'),
        ('system', 'System Message'),
    ]
    
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=10, choices=SENDER_CHOICES)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    content = models.TextField()
    image = models.ImageField(upload_to='chat_images/', null=True, blank=True)
    
    # Timestamps
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Optional: Link to specific booking or service for context
    related_booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Message metadata
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-sent_at']
    
    def __str__(self):
        return f"{self.sender_type}: {self.content[:50]}..."
    
    def mark_as_read(self):
        """Mark message as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()
