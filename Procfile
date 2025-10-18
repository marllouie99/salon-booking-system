web: python manage.py migrate --run-syncdb && python create_superuser.py && gunicorn salon_booking.wsgi --bind 0.0.0.0:$PORT
