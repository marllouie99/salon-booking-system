#!/usr/bin/env python
"""
Quick script to create a superuser for Railway deployment
Run this with: railway run python create_admin.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Create superuser if it doesn't exist
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser(
        username='admin',
        email='admin@salonbooking.com',
        password='Admin@123456'  # Change this password after first login!
    )
    print("✅ Superuser created successfully!")
    print("Username: admin")
    print("Password: Admin@123456")
    print("⚠️  Please change this password after first login!")
else:
    print("ℹ️  Superuser already exists")
