"""
Custom Gunicorn response class that adds CORS headers to ALL responses
"""

def post_request(worker, req, environ, resp):
    """Add CORS headers to every response at Gunicorn level"""
    # Get origin from request headers
    origin = environ.get('HTTP_ORIGIN', '*')
    
    # Add CORS headers
    resp.headers.append(('Access-Control-Allow-Origin', origin))
    resp.headers.append(('Access-Control-Allow-Credentials', 'true'))
    resp.headers.append(('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS'))
    resp.headers.append(('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-CSRFToken'))
    resp.headers.append(('Access-Control-Max-Age', '86400'))
    # REMOVED: Cross-Origin-Opener-Policy - blocks Google OAuth postMessage
    # REMOVED: Cross-Origin-Embedder-Policy - not needed for same-origin deployment
