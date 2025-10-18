"""
Activity Logger for Salon Booking System
Tracks user and salon activities to separate log files
"""
import os
import logging
from datetime import datetime
from django.conf import settings
from django.utils import timezone

class ActivityLogger:
    def __init__(self):
        # Create logs directory if it doesn't exist
        self.logs_dir = os.path.join(settings.BASE_DIR, 'logs')
        if not os.path.exists(self.logs_dir):
            os.makedirs(self.logs_dir)
        
        # Setup separate loggers for users and salons
        self.setup_user_logger()
        self.setup_salon_logger()
    
    def setup_user_logger(self):
        """Setup logger for user activities"""
        self.user_logger = logging.getLogger('user_activity')
        self.user_logger.setLevel(logging.INFO)
        
        # Remove existing handlers to avoid duplicates
        for handler in self.user_logger.handlers[:]:
            self.user_logger.removeHandler(handler)
        
        # File handler for user activities
        user_log_file = os.path.join(self.logs_dir, 'user_activities.txt')
        user_handler = logging.FileHandler(user_log_file, encoding='utf-8')
        user_handler.setLevel(logging.INFO)
        
        # Custom formatter for user logs
        user_formatter = logging.Formatter(
            '%(asctime)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        user_handler.setFormatter(user_formatter)
        self.user_logger.addHandler(user_handler)
        
        # Prevent propagation to root logger
        self.user_logger.propagate = False
    
    def setup_salon_logger(self):
        """Setup logger for salon activities"""
        self.salon_logger = logging.getLogger('salon_activity')
        self.salon_logger.setLevel(logging.INFO)
        
        # Remove existing handlers to avoid duplicates
        for handler in self.salon_logger.handlers[:]:
            self.salon_logger.removeHandler(handler)
        
        # File handler for salon activities
        salon_log_file = os.path.join(self.logs_dir, 'salon_activities.txt')
        salon_handler = logging.FileHandler(salon_log_file, encoding='utf-8')
        salon_handler.setLevel(logging.INFO)
        
        # Custom formatter for salon logs
        salon_formatter = logging.Formatter(
            '%(asctime)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        salon_handler.setFormatter(salon_formatter)
        self.salon_logger.addHandler(salon_handler)
        
        # Prevent propagation to root logger
        self.salon_logger.propagate = False
    
    def log_user_activity(self, user, action, details=None, ip_address=None):
        """
        Log user activity
        
        Args:
            user: User object or user email/id
            action: Description of the action
            details: Additional details (dict or string)
            ip_address: User's IP address
        """
        try:
            # Format user info
            if hasattr(user, 'email'):
                user_info = f"{user.email} (ID: {user.id})"
                user_type = getattr(user, 'user_type', 'unknown')
            else:
                user_info = str(user)
                user_type = 'unknown'
            
            # Format details
            details_str = ""
            if details:
                if isinstance(details, dict):
                    details_list = [f"{k}: {v}" for k, v in details.items()]
                    details_str = f" | Details: {', '.join(details_list)}"
                else:
                    details_str = f" | Details: {details}"
            
            # Format IP address
            ip_str = f" | IP: {ip_address}" if ip_address else ""
            
            # Create log message
            message = f"USER [{user_type.upper()}] {user_info} | Action: {action}{details_str}{ip_str}"
            
            # Log to file
            self.user_logger.info(message)
            
        except Exception as e:
            print(f"Error logging user activity: {e}")
    
    def log_salon_activity(self, salon, user, action, details=None, ip_address=None):
        """
        Log salon-related activity
        
        Args:
            salon: Salon object or salon name/id
            user: User who performed the action
            action: Description of the action
            details: Additional details (dict or string)
            ip_address: User's IP address
        """
        try:
            # Format salon info
            if hasattr(salon, 'name'):
                salon_info = f"{salon.name} (ID: {salon.id})"
            else:
                salon_info = str(salon)
            
            # Format user info
            if hasattr(user, 'email'):
                user_info = f"{user.email} (ID: {user.id})"
            else:
                user_info = str(user)
            
            # Format details
            details_str = ""
            if details:
                if isinstance(details, dict):
                    details_list = [f"{k}: {v}" for k, v in details.items()]
                    details_str = f" | Details: {', '.join(details_list)}"
                else:
                    details_str = f" | Details: {details}"
            
            # Format IP address
            ip_str = f" | IP: {ip_address}" if ip_address else ""
            
            # Create log message
            message = f"SALON {salon_info} | User: {user_info} | Action: {action}{details_str}{ip_str}"
            
            # Log to file
            self.salon_logger.info(message)
            
        except Exception as e:
            print(f"Error logging salon activity: {e}")
    
    def log_booking_activity(self, booking, user, action, details=None, ip_address=None):
        """
        Log booking-related activity (affects both user and salon)
        
        Args:
            booking: Booking object
            user: User who performed the action
            action: Description of the action
            details: Additional details
            ip_address: User's IP address
        """
        try:
            booking_details = {
                'booking_id': booking.id,
                'service': booking.service.name,
                'date': booking.booking_date.strftime('%Y-%m-%d'),
                'time': booking.booking_time.strftime('%H:%M'),
                'price': f"${booking.price}"
            }
            
            if details:
                if isinstance(details, dict):
                    booking_details.update(details)
                else:
                    booking_details['note'] = details
            
            # Log as user activity
            self.log_user_activity(
                user=booking.customer,
                action=f"BOOKING {action}",
                details=booking_details,
                ip_address=ip_address
            )
            
            # Log as salon activity
            self.log_salon_activity(
                salon=booking.salon,
                user=user,
                action=f"BOOKING {action}",
                details=booking_details,
                ip_address=ip_address
            )
            
        except Exception as e:
            print(f"Error logging booking activity: {e}")
    
    def log_transaction_activity(self, transaction, user, action, details=None, ip_address=None):
        """
        Log transaction-related activity
        
        Args:
            transaction: Transaction object
            user: User who performed the action
            action: Description of the action
            details: Additional details
            ip_address: User's IP address
        """
        try:
            transaction_details = {
                'transaction_id': f"TXN-{transaction.id:06d}",
                'amount': f"${transaction.amount}",
                'payment_method': transaction.payment_method,
                'status': transaction.status,
                'service': transaction.booking.service.name,
                'salon_payout': f"${transaction.salon_payout}",
                'platform_fee': f"${transaction.platform_fee}"
            }
            
            if details:
                if isinstance(details, dict):
                    transaction_details.update(details)
                else:
                    transaction_details['note'] = details
            
            # Log as user activity
            self.log_user_activity(
                user=transaction.customer,
                action=f"PAYMENT {action}",
                details=transaction_details,
                ip_address=ip_address
            )
            
            # Log as salon activity
            self.log_salon_activity(
                salon=transaction.salon,
                user=user,
                action=f"PAYMENT {action}",
                details=transaction_details,
                ip_address=ip_address
            )
            
        except Exception as e:
            print(f"Error logging transaction activity: {e}")
    
    def get_client_ip(self, request):
        """Get client IP address from request"""
        try:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0]
            else:
                ip = request.META.get('REMOTE_ADDR')
            return ip
        except:
            return None

# Create global logger instance
activity_logger = ActivityLogger()

# Convenience functions for easy import
def log_user_activity(user, action, details=None, request=None):
    """Convenience function to log user activity"""
    ip_address = activity_logger.get_client_ip(request) if request else None
    activity_logger.log_user_activity(user, action, details, ip_address)

def log_salon_activity(salon, user, action, details=None, request=None):
    """Convenience function to log salon activity"""
    ip_address = activity_logger.get_client_ip(request) if request else None
    activity_logger.log_salon_activity(salon, user, action, details, ip_address)

def log_booking_activity(booking, user, action, details=None, request=None):
    """Convenience function to log booking activity"""
    ip_address = activity_logger.get_client_ip(request) if request else None
    activity_logger.log_booking_activity(booking, user, action, details, ip_address)

def log_transaction_activity(transaction, user, action, details=None, request=None):
    """Convenience function to log transaction activity"""
    ip_address = activity_logger.get_client_ip(request) if request else None
    activity_logger.log_transaction_activity(transaction, user, action, details, ip_address)
