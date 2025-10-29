#!/usr/bin/env python
"""
Script to create super admin user for Railway deployment
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from accounts.models import User

def create_super_admin():
    email = 'ramdar143@admin.com'
    username = 'ramdar143'
    password = 'ramdar143'
    
    try:
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            print(f'✓ Super admin already exists: {email}')
            return
        
        if User.objects.filter(username=username).exists():
            print(f'✓ Super admin already exists with username: {username}')
            return
        
        # Create super admin user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name='Admin',
            last_name='Super',
            user_type='admin',
            is_staff=True,
            is_superuser=True,
            is_active=True,
            is_email_verified=True
        )
        
        print(f'✓ Successfully created super admin: {email}')
        print(f'  Username: {username}')
        print(f'  Password: {password}')
        
    except Exception as e:
        print(f'✗ Error creating super admin: {str(e)}')
        raise

if __name__ == '__main__':
    create_super_admin()
