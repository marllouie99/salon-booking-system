"""
Management command to cancel expired pending bookings
Run this periodically (e.g., every 5 minutes) using a cron job or scheduler
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from bookings.models import Booking


class Command(BaseCommand):
    help = 'Cancel pending bookings that have expired (older than 15 minutes without payment)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes',
            type=int,
            default=15,
            help='Number of minutes before a pending booking expires (default: 15)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cancelled without actually cancelling'
        )

    def handle(self, *args, **options):
        minutes = options['minutes']
        dry_run = options['dry_run']
        
        # Calculate cutoff time
        cutoff_time = timezone.now() - timedelta(minutes=minutes)
        
        # Find expired pending bookings
        expired_bookings = Booking.objects.filter(
            status='pending',
            payment_status='pending',
            created_at__lt=cutoff_time
        ).exclude(
            payment_method='pay_later'  # Don't cancel pay_later bookings
        )
        
        count = expired_bookings.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No expired bookings found'))
            return
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'[DRY RUN] Would cancel {count} expired booking(s):')
            )
            for booking in expired_bookings:
                self.stdout.write(
                    f'  - Booking #{booking.id}: {booking.customer_name} at {booking.salon.name} '
                    f'on {booking.booking_date} {booking.booking_time} '
                    f'(created {booking.created_at})'
                )
        else:
            # Cancel the bookings
            for booking in expired_bookings:
                self.stdout.write(
                    f'Cancelling booking #{booking.id}: {booking.customer_name} at {booking.salon.name}'
                )
                booking.status = 'cancelled'
                booking.save()
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully cancelled {count} expired booking(s)')
            )
