"""
Passenger WSGI file for Hostinger deployment.
Hostinger uses Passenger to run Python applications.
"""

import os
import sys

# Add your project directory to the sys.path
INTERP = os.path.join(os.environ['HOME'], 'virtualenv', 'salon_booking', '3.9', 'bin', 'python3')
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)

# Add the project directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

# Set the Django settings module
os.environ['DJANGO_SETTINGS_MODULE'] = 'salon_booking.settings'

# Import Django application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
