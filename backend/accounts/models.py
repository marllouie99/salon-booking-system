from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta

class User(AbstractUser):
    USER_TYPE_CHOICES = [
        ('customer', 'Customer'),
        ('salon_owner', 'Salon Owner'),
        ('admin', 'Admin'),
    ]
    
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='customer')
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    
    # Email Verification
    is_email_verified = models.BooleanField(default=False)
    email_verification_code = models.CharField(max_length=6, blank=True, null=True)
    verification_code_expires = models.DateTimeField(blank=True, null=True)
    
    # Password Reset
    password_reset_code = models.CharField(max_length=6, blank=True, null=True)
    password_reset_expires = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.username} ({self.user_type})"
    
    def is_verification_code_valid(self):
        """Check if verification code is still valid"""
        if not self.verification_code_expires:
            return False
        return timezone.now() < self.verification_code_expires
    
    def is_password_reset_code_valid(self):
        """Check if password reset code is still valid"""
        if not self.password_reset_expires:
            return False
        return timezone.now() < self.password_reset_expires
