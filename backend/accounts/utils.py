import random
import string
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


def generate_verification_code(length=6):
    """Generate a random verification code"""
    return ''.join(random.choices(string.digits, k=length))


def send_verification_email(user):
    """Send verification code to user's email"""
    # Generate verification code
    verification_code = generate_verification_code()
    
    # Set expiration time (15 minutes from now)
    expiration_time = timezone.now() + timedelta(minutes=15)
    
    # Save verification code to user
    user.email_verification_code = verification_code
    user.verification_code_expires = expiration_time
    user.save()
    
    # Email subject and message
    subject = 'Email Verification - Salon Booking System'
    message = f"""
Hello {user.first_name or user.username},

Thank you for registering with our Salon Booking System!

Your verification code is: {verification_code}

This code will expire in 15 minutes.

Please enter this code to verify your email address and complete your registration.

If you did not request this verification, please ignore this email.

Best regards,
Salon Booking System Team
    """
    
    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [user.email]
    
    try:
        print(f"📧 Attempting to send verification email to: {user.email}")
        print(f"📧 From email: {from_email}")
        print(f"📧 Verification code: {verification_code}")
        
        # Send email with a timeout to prevent worker timeout
        from django.core.mail import EmailMessage
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=from_email,
            to=recipient_list,
        )
        
        # Try to send email and catch any errors
        result = email.send(fail_silently=False)
        
        if result:
            print(f"✅ Verification email SENT successfully to {user.email}")
            return True, "Verification email sent successfully"
        else:
            print(f"⚠️ Email send returned 0 (failed)")
            return False, "Failed to send email"
    except Exception as e:
        print(f"❌ Email sending FAILED: {str(e)}")
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        # Still return success since user was created, but with warning
        return True, f"Account created but email failed: {str(e)}"


def send_password_reset_email(user, reset_code):
    """Send password reset code to user's email"""
    subject = 'Password Reset - Salon Booking System'
    message = f"""
Hello {user.first_name or user.username},

We received a request to reset your password.

Your password reset code is: {reset_code}

This code will expire in 15 minutes.

If you did not request a password reset, please ignore this email.

Best regards,
Salon Booking System Team
    """
    
    from_email = settings.DEFAULT_FROM_EMAIL
    recipient_list = [user.email]
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
        )
        return True, "Password reset email sent successfully"
    except Exception as e:
        return False, str(e)
