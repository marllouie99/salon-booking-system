import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("=" * 60)
print("TESTING EMAIL CONFIGURATION")
print("=" * 60)

print(f"\n📧 Email Settings:")
print(f"   Host: {settings.EMAIL_HOST}")
print(f"   Port: {settings.EMAIL_PORT}")
print(f"   Use TLS: {settings.EMAIL_USE_TLS}")
print(f"   From: {settings.EMAIL_HOST_USER}")
print(f"   Password: {'*' * len(settings.EMAIL_HOST_PASSWORD)}")

print(f"\n📬 Sending test email...")

try:
    result = send_mail(
        subject='🧪 Test Email - Salon Booking System',
        message='This is a test email. If you receive this, your email configuration is working correctly!',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=['marllouie4@gmail.com'],  # Sending to yourself
        fail_silently=False,
    )
    
    print(f"✅ SUCCESS! Email sent successfully.")
    print(f"   Check your inbox: marllouie4@gmail.com")
    print(f"   (Also check spam folder)")
    
except Exception as e:
    print(f"❌ FAILED! Error sending email:")
    print(f"   {type(e).__name__}: {e}")
    
    import traceback
    print("\n📋 Full error trace:")
    traceback.print_exc()

print("\n" + "=" * 60)
