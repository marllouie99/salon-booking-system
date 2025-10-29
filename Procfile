web: cd backend && python manage.py migrate --run-syncdb && python create_admin.py && gunicorn salon_booking.wsgi --bind 0.0.0.0:$PORT
