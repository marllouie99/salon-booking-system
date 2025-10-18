#!/usr/bin/env python
"""
Create superuser for Railway deployment
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Create superuser with your credentials
username = 'asus'
email = 'asus@salonbooking.com'
password = 'ramdar143'

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(
        username=username,
        email=email,
        password=password
    )
    print(f"✅ Superuser '{username}' created successfully!")
    print(f"Username: {username}")
    print(f"Password: {password}")
else:
    print(f"ℹ️  User '{username}' already exists")
    # Update password if user exists
    user = User.objects.get(username=username)
    user.set_password(password)
    user.is_superuser = True
    user.is_staff = True
    user.save()
    print(f"✅ Password updated for '{username}'")
