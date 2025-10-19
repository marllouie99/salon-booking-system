"""
Test script to diagnose email sending for salon application approvals
Run this script to test if emails are being sent correctly
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.conf import settings
from django.contrib.auth import get_user_model
from salons.models import SalonApplication, Salon

User = get_user_model()

print("=" * 80)
print("SALON APPLICATION APPROVAL EMAIL DIAGNOSTIC TEST")
print("=" * 80)

# Check email configuration
print("\n📧 EMAIL CONFIGURATION:")
print(f"   Backend: {settings.EMAIL_BACKEND}")
print(f"   Host: {settings.EMAIL_HOST}")
print(f"   Port: {settings.EMAIL_PORT}")
print(f"   Use TLS: {settings.EMAIL_USE_TLS}")
print(f"   From Email: {settings.DEFAULT_FROM_EMAIL}")
print(f"   Host User: {settings.EMAIL_HOST_USER}")
print(f"   Password Set: {'Yes' if settings.EMAIL_HOST_PASSWORD else 'No'}")

# Check Brevo API
brevo_api_key = getattr(settings, 'BREVO_API_KEY', None)
print(f"\n🔑 BREVO API:")
print(f"   API Key Set: {'Yes' if brevo_api_key else 'No'}")
if brevo_api_key:
    print(f"   API Key Length: {len(brevo_api_key)}")

# Check if Brevo SDK is available
try:
    import sib_api_v3_sdk
    print(f"   SDK Installed: Yes")
except ImportError:
    print(f"   SDK Installed: No (CRITICAL - Install with: pip install sib-api-v3-sdk)")

# Check for pending applications
print("\n📋 CHECKING SALON APPLICATIONS:")
pending_apps = SalonApplication.objects.filter(status='pending')
print(f"   Pending Applications: {pending_apps.count()}")

approved_apps = SalonApplication.objects.filter(status='approved')
print(f"   Approved Applications: {approved_apps.count()}")

# Get the most recent application for testing
recent_app = SalonApplication.objects.order_by('-created_at').first()

if recent_app:
    print(f"\n📝 MOST RECENT APPLICATION:")
    print(f"   ID: {recent_app.id}")
    print(f"   Salon Name: {recent_app.salon_name}")
    print(f"   Applicant: {recent_app.user.email}")
    print(f"   Status: {recent_app.status}")
    print(f"   Created: {recent_app.created_at}")
    
    # Test email sending
    print(f"\n🧪 TESTING EMAIL SEND:")
    print(f"   Would send to: {recent_app.user.email}")
    
    if recent_app.business_email and recent_app.business_email != recent_app.user.email:
        print(f"   Also send to: {recent_app.business_email}")
    
    # Ask if user wants to send a test email
    print("\n" + "=" * 80)
    response = input("Do you want to send a TEST approval email? (yes/no): ").strip().lower()
    
    if response == 'yes':
        print("\n📤 Sending test email...")
        
        # Import the email function
        from salons.views import send_approval_email
        
        # If the application is already approved, get the salon
        if recent_app.status == 'approved':
            salon = Salon.objects.filter(application=recent_app).first()
            if salon:
                result = send_approval_email(recent_app, salon)
                if result:
                    print("\n✅ TEST EMAIL SENT SUCCESSFULLY!")
                    print(f"   Check inbox: {recent_app.user.email}")
                else:
                    print("\n❌ TEST EMAIL FAILED!")
                    print("   Check the error messages above for details")
            else:
                print("\n⚠️ No salon found for this approved application")
        else:
            print("\n⚠️ This application is not approved yet")
            print("   To test, you need an approved application with a salon created")
    else:
        print("\n⏭️ Skipping test email send")
else:
    print("\n⚠️ No applications found in the database")

# Check admin users
print("\n👤 ADMIN USERS:")
admins = User.objects.filter(is_staff=True)
print(f"   Total Admins: {admins.count()}")
for admin in admins:
    print(f"   - {admin.email} (Superuser: {admin.is_superuser})")

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)

print("\n💡 RECOMMENDATIONS:")
print("   1. Ensure BREVO_API_KEY is set in your .env file")
print("   2. Verify the Brevo SDK is installed: pip install sib-api-v3-sdk")
print("   3. Check that your Brevo account is active and verified")
print("   4. Make sure the sender email is verified in Brevo")
print("   5. Check Railway logs for any email errors during approval")
print("   6. Test with a real approval to see the actual logs")
