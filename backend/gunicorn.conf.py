"""
Gunicorn configuration with CORS headers injection
"""
import logging
import os

# Logging
loglevel = 'debug'
accesslog = '-'
errorlog = '-'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Server mechanics - bind will be overridden by command line
workers = 2
worker_class = 'sync'
timeout = 120
keepalive = 2

# Security
forwarded_allow_ips = '*'
secure_scheme_headers = {
    'X-FORWARDED-PROTOCOL': 'ssl',
    'X-FORWARDED-PROTO': 'https',
    'X-FORWARDED-SSL': 'on'
}

def post_request(worker, req, environ, resp):
    """Add CORS headers to every response"""
    origin = environ.get('HTTP_ORIGIN', '*')
    
    # Add CORS headers to response (no COOP since same-origin now)
    cors_headers = [
        ('Access-Control-Allow-Origin', origin),
        ('Access-Control-Allow-Credentials', 'true'),
        ('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-CSRFToken'),
        ('Access-Control-Max-Age', '86400'),
    ]
    
    for header, value in cors_headers:
        resp.headers.append((header, value))
    
    logging.debug(f"Added CORS headers for origin: {origin}")
