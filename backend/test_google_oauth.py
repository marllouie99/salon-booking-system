"""
Test script to verify Google OAuth configuration
Run this from the backend directory: python test_google_oauth.py
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
import django
django.setup()

from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

def test_google_oauth_config():
    """Test Google OAuth configuration"""
    print("=" * 60)
    print("GOOGLE OAUTH CONFIGURATION TEST")
    print("=" * 60)
    
    # Check if Client ID is configured
    client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', None)
    client_secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', None)
    
    print("\n1. Configuration Check:")
    print(f"   Client ID: {client_id[:20]}...{client_id[-20:] if client_id else 'NOT SET'}")
    print(f"   Client Secret: {'SET' if client_secret else 'NOT SET'}")
    
    if not client_id:
        print("\n❌ ERROR: GOOGLE_OAUTH_CLIENT_ID is not configured!")
        print("   Please check your .env file")
        return False
    
    if not client_secret:
        print("\n⚠️  WARNING: GOOGLE_OAUTH_CLIENT_SECRET is not configured!")
        print("   This is optional but recommended")
    
    # Test network connectivity to Google
    print("\n2. Network Connectivity Test:")
    try:
        import requests
        response = requests.get('https://www.googleapis.com', timeout=5)
        print(f"   ✅ Can reach Google APIs (Status: {response.status_code})")
    except Exception as e:
        print(f"   ❌ Cannot reach Google APIs: {str(e)}")
        print("   Check your internet connection")
        return False
    
    # Test Google token verification endpoint
    print("\n3. Google Token Verification Endpoint Test:")
    try:
        request = google_requests.Request()
        print("   ✅ Google Request object created successfully")
    except Exception as e:
        print(f"   ❌ Failed to create Google Request: {str(e)}")
        return False
    
    print("\n4. Expected Client ID in Frontend:")
    print(f"   {client_id}")
    print("\n   Make sure this matches the GOOGLE_CLIENT_ID in:")
    print("   - frontend/public/script.js")
    
    print("\n" + "=" * 60)
    print("CONFIGURATION TEST COMPLETE")
    print("=" * 60)
    
    print("\n📋 Next Steps:")
    print("   1. Ensure frontend Client ID matches backend")
    print("   2. Verify Google Cloud Console settings:")
    print("      - Authorized JavaScript origins: http://localhost:3000")
    print("      - Authorized redirect URIs: http://localhost:3000")
    print("   3. Clear browser cache and try again")
    print("   4. Check browser console for detailed error messages")
    
    return True

def test_token_verification(test_token=None):
    """Test token verification with a sample token"""
    if not test_token:
        print("\n⚠️  No test token provided")
        print("   To test with a real token, get one from browser console:")
        print("   1. Open http://localhost:3000")
        print("   2. Open browser DevTools (F12)")
        print("   3. Go to Network tab")
        print("   4. Click 'Sign in with Google'")
        print("   5. Find the POST request to google-login")
        print("   6. Copy the token from request payload")
        return
    
    print("\n5. Token Verification Test:")
    try:
        client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        request = google_requests.Request()
        idinfo = id_token.verify_oauth2_token(test_token, request, client_id)
        print(f"   ✅ Token verified successfully!")
        print(f"   Email: {idinfo.get('email')}")
        print(f"   Name: {idinfo.get('name')}")
    except ValueError as e:
        print(f"   ❌ Token verification failed: {str(e)}")
    except Exception as e:
        print(f"   ❌ Unexpected error: {str(e)}")

if __name__ == '__main__':
    print("\n🔍 Testing Google OAuth Configuration...\n")
    
    # Run configuration test
    config_ok = test_google_oauth_config()
    
    # Check if token provided as argument
    if len(sys.argv) > 1:
        test_token = sys.argv[1]
        test_token_verification(test_token)
    
    print("\n✅ Test complete!\n")
