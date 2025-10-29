"""
Custom middleware for handling security headers and CORS
"""
from django.http import HttpResponse

class SecurityHeadersMiddleware:
    """
    Middleware to set security headers that allow Google OAuth to work properly
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Handle OPTIONS (preflight) requests immediately
        if request.method == 'OPTIONS':
            response = HttpResponse()
            response['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Max-Age'] = '86400'
            response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
            response['Cross-Origin-Embedder-Policy'] = 'unsafe-none'
            response.status_code = 200
            return response
        
        # Process normal requests
        response = self.get_response(request)
        
        # Set Cross-Origin-Opener-Policy to allow OAuth popups
        response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
        
        # Set Cross-Origin-Embedder-Policy to allow cross-origin resources
        response['Cross-Origin-Embedder-Policy'] = 'unsafe-none'
        
        # Add CORS headers to all responses
        if 'Origin' in request.headers:
            response['Access-Control-Allow-Origin'] = request.headers['Origin']
            response['Access-Control-Allow-Credentials'] = 'true'
        
        return response
