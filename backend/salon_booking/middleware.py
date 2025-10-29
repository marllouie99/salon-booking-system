"""
Custom middleware for handling security headers and CORS
"""
from django.http import HttpResponse
import logging

logger = logging.getLogger(__name__)

class SecurityHeadersMiddleware:
    """
    Middleware to set security headers that allow Google OAuth to work properly
    """
    def __init__(self, get_response):
        self.get_response = get_response
        logger.info("SecurityHeadersMiddleware initialized")

    def __call__(self, request):
        logger.info(f"SecurityHeadersMiddleware called: {request.method} {request.path}")
        
        # Handle OPTIONS (preflight) requests immediately
        if request.method == 'OPTIONS':
            logger.info(f"Handling OPTIONS preflight for {request.path}")
            response = HttpResponse()
            origin = request.headers.get('Origin', '*')
            logger.info(f"Origin: {origin}")
            
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Max-Age'] = '86400'
            response.status_code = 200
            logger.info("Returning OPTIONS response with CORS headers")
            return response
        
        # Process normal requests
        response = self.get_response(request)
        
        # Add CORS headers to all responses
        if 'Origin' in request.headers:
            response['Access-Control-Allow-Origin'] = request.headers['Origin']
            response['Access-Control-Allow-Credentials'] = 'true'
        
        return response
