"""
Django management command to create a super admin user
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates a super admin user if it does not exist'

    def handle(self, *args, **options):
        email = 'ramdar143@admin.com'
        username = 'ramdar143'
        password = 'ramdar143'
        
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f'Super admin with email {email} already exists')
            )
            return
        
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'Super admin with username {username} already exists')
            )
            return
        
        try:
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
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created super admin: {email}')
            )
            self.stdout.write(
                self.style.SUCCESS(f'Password: {password}')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating super admin: {str(e)}')
            )
