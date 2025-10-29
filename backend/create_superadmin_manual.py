#!/usr/bin/env python
"""
Manually create super admin user
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from accounts.models import User

def create_superadmin():
    email = 'ramdar143@admin.com'
    username = 'ramdar143'
    password = 'ramdar143'
    
    # Delete existing user if exists
    User.objects.filter(email=email).delete()
    User.objects.filter(username=username).delete()
    
    print("Creating super admin...")
    
    # Create super admin
    user = User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
        first_name='Admin',
        last_name='Super'
    )
    
    # Set additional fields
    user.user_type = 'admin'
    user.is_email_verified = True
    user.save()
    
    print("=" * 60)
    print("✓ Super Admin Created Successfully!")
    print("=" * 60)
    print(f"Username: {username}")
    print(f"Email: {email}")
    print(f"Password: {password}")
    print(f"Is Staff: {user.is_staff}")
    print(f"Is Superuser: {user.is_superuser}")
    print(f"Is Active: {user.is_active}")
    print(f"User Type: {user.user_type}")
    print("=" * 60)
    print("\nYou can now login at: http://localhost:8000/admin/")
    
    # Print the password hash for Railway
    print("\n" + "=" * 60)
    print("For Railway Database - Copy this password hash:")
    print("=" * 60)
    print(user.password)
    print("=" * 60)

if __name__ == '__main__':
    create_superadmin()
