"""
Quick script to verify Google OAuth configuration
Run this on your Railway deployment to check if environment variables are set
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.conf import settings

print("=" * 60)
print("GOOGLE OAUTH CONFIGURATION CHECK")
print("=" * 60)

# Check Client ID
client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', None)
client_secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', None)

print(f"\n1. Client ID Status:")
if client_id:
    print(f"   ✓ SET: {client_id[:20]}...{client_id[-20:]}")
else:
    print(f"   ✗ NOT SET - This will cause 500 errors!")
    print(f"   → Add GOOGLE_OAUTH_CLIENT_ID to Railway environment variables")

print(f"\n2. Client Secret Status:")
if client_secret:
    print(f"   ✓ SET: {client_secret[:10]}...{client_secret[-10:]}")
else:
    print(f"   ⚠ NOT SET - Optional but recommended")

print(f"\n3. Expected Client ID:")
print(f"   283246214071-eqctr8egt9snucarjlsig6o2rbg9aqe2.apps.googleusercontent.com")

print(f"\n4. Match Status:")
expected_id = "283246214071-eqctr8egt9snucarjlsig6o2rbg9aqe2.apps.googleusercontent.com"
if client_id == expected_id:
    print(f"   ✓ Client ID matches frontend configuration")
else:
    print(f"   ✗ MISMATCH! Backend and frontend have different Client IDs")
    print(f"   → Update either frontend script.js or backend .env file")

print(f"\n5. Django Settings:")
print(f"   DEBUG: {settings.DEBUG}")
print(f"   ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")

print("\n" + "=" * 60)
print("RECOMMENDATIONS:")
print("=" * 60)

if not client_id:
    print("\n❌ CRITICAL: Set GOOGLE_OAUTH_CLIENT_ID in Railway")
    print("   1. Go to Railway dashboard")
    print("   2. Select your project")
    print("   3. Go to Variables tab")
    print("   4. Add: GOOGLE_OAUTH_CLIENT_ID = 283246214071-eqctr8egt9snucarjlsig6o2rbg9aqe2.apps.googleusercontent.com")
    print("   5. Redeploy the application")
elif client_id != expected_id:
    print("\n⚠ WARNING: Client ID mismatch")
    print("   Frontend expects:", expected_id)
    print("   Backend has:", client_id)
else:
    print("\n✓ Configuration looks good!")
    print("  If you're still getting errors, check Google Cloud Console:")
    print("  - Ensure https://web-production-11e43.up.railway.app is in Authorized JavaScript origins")
    print("  - Wait 5-10 minutes after making changes")
    print("  - Clear browser cache")

print("\n" + "=" * 60)
