"""
Custom middleware for handling security headers and CORS
"""

class SecurityHeadersMiddleware:
    """
    Middleware to set security headers that allow Google OAuth to work properly
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Set Cross-Origin-Opener-Policy to allow OAuth popups
        # Using 'same-origin-allow-popups' allows popups from same origin
        # while maintaining some security
        response['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
        
        # Set Cross-Origin-Embedder-Policy to allow cross-origin resources
        response['Cross-Origin-Embedder-Policy'] = 'unsafe-none'
        
        # Ensure CORS headers are present for preflight requests
        if request.method == 'OPTIONS':
            response['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Max-Age'] = '86400'  # Cache preflight for 24 hours
        
        return response
