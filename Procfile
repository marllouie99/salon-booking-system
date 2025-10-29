web: cd backend && python manage.py migrate --run-syncdb && python manage.py create_superadmin && gunicorn salon_booking.wsgi --bind 0.0.0.0:$PORT
