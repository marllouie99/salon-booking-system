"""
WSGI config for production deployment on Hostinger.
"""

import os
import sys

# Add the project directory to the sys.path
path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if path not in sys.path:
    sys.path.append(path)

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
