import random
import string
import logging
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

# Import Brevo SDK if available
try:
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException
    BREVO_SDK_AVAILABLE = True
except ImportError:
    BREVO_SDK_AVAILABLE = False
    logging.warning("Brevo SDK not available. Email will use SMTP fallback.")

logger = logging.getLogger(__name__)


def generate_verification_code(length=6):
    """Generate a random verification code"""
    return ''.join(random.choices(string.digits, k=length))


def send_verification_email(user):
    """Send verification code to user's email using Brevo API"""
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
    
    logger.info(f"📧 Attempting to send verification email to: {user.email}")
    print(f"📧 Attempting to send verification email to: {user.email}")
    print(f"📧 From email: {from_email}")
    print(f"📧 Verification code: {verification_code}")
    
    try:
        # Use Brevo API if available (recommended for production)
        brevo_api_key = getattr(settings, 'BREVO_API_KEY', None)
        
        if brevo_api_key and BREVO_SDK_AVAILABLE:
            logger.info("Using Brevo API for email delivery")
            print("Using Brevo API for email delivery")
            
            try:
                configuration = sib_api_v3_sdk.Configuration()
                configuration.api_key['api-key'] = brevo_api_key
                
                api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=[{"email": user.email, "name": user.first_name or user.username}],
                    sender={"email": from_email, "name": "Salon Booking System"},
                    subject=subject,
                    text_content=message
                )
                
                api_response = api_instance.send_transac_email(send_smtp_email)
                logger.info(f"✅ Verification email SENT successfully via Brevo API - Message ID: {api_response.message_id}")
                print(f"✅ Verification email SENT successfully via Brevo API to {user.email}")
                print(f"✅ Message ID: {api_response.message_id}")
                return True, "Verification email sent successfully"
                
            except ApiException as e:
                logger.error(f"❌ Brevo API error: {e}")
                print(f"❌ Brevo API error: {e}")
                # Fall through to SMTP fallback
        
        # Fallback to Django SMTP
        logger.info("Using SMTP for email delivery")
        print("Using SMTP for email delivery")
        
        from django.core.mail import EmailMessage
        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=from_email,
            to=[user.email],
        )
        result = email.send(fail_silently=False)
        
        if result:
            logger.info(f"✅ Verification email SENT successfully via SMTP to {user.email}")
            print(f"✅ Verification email SENT successfully to {user.email}")
            return True, "Verification email sent successfully"
        else:
            logger.warning(f"⚠️ Email send returned 0 (failed)")
            print(f"⚠️ Email send returned 0 (failed)")
            return False, "Failed to send email"
                
    except Exception as e:
        logger.error(f"❌ Email sending FAILED: {str(e)}", exc_info=True)
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
    
    logger.info(f"📧 Attempting to send password reset email to: {user.email}")
    print(f"📧 Attempting to send password reset email to: {user.email}")
    
    try:
        # Use Brevo API if available
        brevo_api_key = getattr(settings, 'BREVO_API_KEY', None)
        
        if brevo_api_key and BREVO_SDK_AVAILABLE:
            try:
                configuration = sib_api_v3_sdk.Configuration()
                configuration.api_key['api-key'] = brevo_api_key
                
                api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
                
                send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                    to=[{"email": user.email, "name": user.first_name or user.username}],
                    sender={"email": from_email, "name": "Salon Booking System"},
                    subject=subject,
                    text_content=message
                )
                
                api_response = api_instance.send_transac_email(send_smtp_email)
                logger.info(f"✅ Password reset email SENT successfully via Brevo API - Message ID: {api_response.message_id}")
                print(f"✅ Password reset email SENT successfully via Brevo API")
                return True, "Password reset email sent successfully"
                
            except ApiException as e:
                logger.error(f"❌ Brevo API error: {e}")
                print(f"❌ Brevo API error: {e}")
                # Fall through to SMTP fallback
        
        # Fallback to SMTP
        result = send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
        )
        
        if result > 0:
            logger.info(f"✅ Password reset email SENT successfully via SMTP")
            print(f"✅ Password reset email SENT successfully via SMTP")
            return True, "Password reset email sent successfully"
        else:
            logger.warning(f"⚠️ Email may not have been sent")
            return False, "Failed to send email"
            
    except Exception as e:
        logger.error(f"❌ Failed to send password reset email: {e}", exc_info=True)
        print(f"❌ Failed to send password reset email: {e}")
        return False, str(e)
