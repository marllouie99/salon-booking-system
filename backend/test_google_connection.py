#!/usr/bin/env python
"""
Google OAuth Connection Test Script
This script tests connectivity to Google's OAuth servers and diagnoses issues.
"""

import sys
import socket
import requests
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter


def test_dns_resolution():
    """Test if www.googleapis.com can be resolved"""
    print("\n" + "="*60)
    print("TEST 1: DNS Resolution")
    print("="*60)
    
    try:
        ip_address = socket.gethostbyname('www.googleapis.com')
        print(f"[PASS] SUCCESS: Resolved www.googleapis.com to {ip_address}")
        return True
    except socket.gaierror as e:
        print(f"[FAIL] FAILED: Cannot resolve www.googleapis.com")
        print(f"   Error: {e}")
        print("\n   SOLUTION: Check your DNS settings or internet connection")
        return False


def test_basic_connection():
    """Test basic HTTPS connection to Google"""
    print("\n" + "="*60)
    print("TEST 2: Basic HTTPS Connection")
    print("="*60)
    
    try:
        response = requests.get('https://www.googleapis.com/oauth2/v1/certs', timeout=10)
        if response.status_code == 200:
            print(f"[PASS] SUCCESS: Connected to Google OAuth servers")
            print(f"   Status: {response.status_code}")
            print(f"   Response size: {len(response.content)} bytes")
            return True
        else:
            print(f"[WARN] WARNING: Unexpected status code: {response.status_code}")
            return False
    except requests.exceptions.Timeout:
        print("[FAIL] FAILED: Connection timeout")
        print("\n   SOLUTION: Check firewall or proxy settings")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"[FAIL] FAILED: Cannot connect to Google servers")
        print(f"   Error: {e}")
        print("\n   SOLUTION: Check internet connection or firewall")
        return False
    except Exception as e:
        print(f"[FAIL] FAILED: Unexpected error: {e}")
        return False


def test_with_retry():
    """Test connection with retry logic (mimics production behavior)"""
    print("\n" + "="*60)
    print("TEST 3: Connection with Retry Logic")
    print("="*60)
    
    try:
        session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        
        print("   Attempting connection with 3 retries...")
        response = session.get('https://www.googleapis.com/oauth2/v1/certs', timeout=10)
        
        if response.status_code == 200:
            print(f"[PASS] SUCCESS: Connection successful with retry logic")
            print(f"   Certificates retrieved: {len(response.json())} keys")
            return True
        else:
            print(f"[WARN] WARNING: Status code {response.status_code}")
            return False
            
    except Exception as e:
        print(f"[FAIL] FAILED: Connection failed even with retries")
        print(f"   Error: {e}")
        print("\n   SOLUTION: Network issue - check internet, DNS, firewall")
        return False


def test_google_oauth_integration():
    """Test Google OAuth token verification (requires google-auth package)"""
    print("\n" + "="*60)
    print("TEST 4: Google OAuth Library Integration")
    print("="*60)
    
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        print("[PASS] Google OAuth libraries imported successfully")
        
        # Try to create a Request object
        try:
            google_request = google_requests.Request()
            print("[PASS] Google Request object created successfully")
            print("\n   Your Google OAuth integration should work!")
            return True
        except Exception as e:
            print(f"[WARN] WARNING: Could not create Google Request: {e}")
            return False
            
    except ImportError as e:
        print(f"[FAIL] FAILED: Google OAuth libraries not installed")
        print(f"   Error: {e}")
        print("\n   SOLUTION: Run 'pip install -r requirements.txt'")
        return False


def check_environment():
    """Check environment settings"""
    print("\n" + "="*60)
    print("TEST 5: Environment Check")
    print("="*60)
    
    import os
    
    # Check proxy settings
    http_proxy = os.environ.get('HTTP_PROXY') or os.environ.get('http_proxy')
    https_proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    
    if http_proxy or https_proxy:
        print(f"[INFO] Proxy detected:")
        if http_proxy:
            print(f"   HTTP_PROXY: {http_proxy}")
        if https_proxy:
            print(f"   HTTPS_PROXY: {https_proxy}")
    else:
        print("[INFO] No proxy configured (direct connection)")
    
    # Check Python version
    print(f"\n[INFO] Python version: {sys.version.split()[0]}")
    
    # Check requests version
    try:
        print(f"[INFO] requests version: {requests.__version__}")
    except:
        pass
    
    return True


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("GOOGLE OAUTH CONNECTION DIAGNOSTIC TOOL")
    print("="*60)
    print("\nThis script will diagnose connectivity issues with Google OAuth")
    
    results = []
    
    # Run all tests
    results.append(("DNS Resolution", test_dns_resolution()))
    results.append(("Basic Connection", test_basic_connection()))
    results.append(("Retry Logic", test_with_retry()))
    results.append(("OAuth Libraries", test_google_oauth_integration()))
    results.append(("Environment", check_environment()))
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "[PASS] PASSED" if result else "[FAIL] FAILED"
        print(f"{status} - {test_name}")
    
    print(f"\nTests Passed: {passed}/{total}")
    
    if passed == total:
        print("\n*** ALL TESTS PASSED! ***")
        print("[PASS] Your Google OAuth integration should work correctly.")
    else:
        print("\n*** SOME TESTS FAILED ***")
        print("[INFO] Check the troubleshooting guide: GOOGLE_OAUTH_TROUBLESHOOTING.md")
        print("[INFO] Fix the issues above and re-run this script")
    
    print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    main()
