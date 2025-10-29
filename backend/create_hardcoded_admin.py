#!/usr/bin/env python
"""
Create hardcoded super admin on startup
This runs automatically via Procfile
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'salon_booking.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def create_hardcoded_admin():
    """Create or update hardcoded super admin"""
    username = 'ramdar143'
    email = 'ramdar143@admin.com'
    password = 'ramdar143'
    
    try:
        # Try to get existing user
        user = User.objects.filter(username=username).first()
        
        if user:
            # Update existing user to ensure it's a superuser
            user.email = email
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.user_type = 'admin'
            user.is_email_verified = True
            user.first_name = 'Admin'
            user.last_name = 'Super'
            user.save()
            print(f'✓ Updated existing super admin: {email}')
        else:
            # Create new superuser
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                first_name='Admin',
                last_name='Super'
            )
            user.user_type = 'admin'
            user.is_email_verified = True
            user.save()
            print(f'✓ Created new super admin: {email}')
        
        print(f'  Username: {username}')
        print(f'  Password: {password}')
        print(f'  Is Staff: {user.is_staff}')
        print(f'  Is Superuser: {user.is_superuser}')
        print(f'  Is Active: {user.is_active}')
        
        return True
        
    except Exception as e:
        print(f'✗ Error with super admin: {str(e)}')
        # Don't fail the deployment, just log the error
        return False

if __name__ == '__main__':
    create_hardcoded_admin()
