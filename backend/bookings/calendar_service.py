"""
Google Calendar Integration Service
Handles syncing bookings with Google Calendar
"""

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class GoogleCalendarService:
    """Service for managing Google Calendar events for bookings"""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    def __init__(self, credentials=None):
        """Initialize the service with optional credentials"""
        self.credentials = credentials
        self.service = None
        
        if credentials:
            self.service = build('calendar', 'v3', credentials=credentials)
    
    def create_booking_event(self, booking, user_credentials=None):
        """
        Create a Google Calendar event for a booking
        
        Args:
            booking: Booking model instance
            user_credentials: User's Google OAuth credentials
            
        Returns:
            dict: Created event data or None if failed
        """
        try:
            if user_credentials:
                service = build('calendar', 'v3', credentials=user_credentials)
            elif self.service:
                service = self.service
            else:
                logger.warning("No credentials available for calendar service")
                return None
            
            # Calculate end time
            start_datetime = datetime.combine(
                booking.booking_date,
                booking.booking_time
            )
            end_datetime = start_datetime + timedelta(minutes=booking.duration)
            
            # Create event
            event = {
                'summary': f'{booking.service.name} at {booking.salon.name}',
                'location': f'{booking.salon.address}, {booking.salon.city}' if booking.salon.address else booking.salon.city,
                'description': self._create_event_description(booking),
                'start': {
                    'dateTime': start_datetime.isoformat(),
                    'timeZone': getattr(settings, 'TIME_ZONE', 'Asia/Manila'),
                },
                'end': {
                    'dateTime': end_datetime.isoformat(),
                    'timeZone': getattr(settings, 'TIME_ZONE', 'Asia/Manila'),
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                        {'method': 'popup', 'minutes': 60},        # 1 hour before
                    ],
                },
                'colorId': '5',  # Banana yellow - good for appointments
            }
            
            # Insert event
            event = service.events().insert(calendarId='primary', body=event).execute()
            
            logger.info(f"Calendar event created: {event.get('htmlLink')}")
            return event
            
        except HttpError as error:
            logger.error(f"Google Calendar API error: {error}")
            return None
        except Exception as e:
            logger.error(f"Error creating calendar event: {e}")
            return None
    
    def update_booking_event(self, event_id, booking, user_credentials=None):
        """
        Update an existing Google Calendar event
        
        Args:
            event_id: Google Calendar event ID
            booking: Updated booking instance
            user_credentials: User's Google OAuth credentials
            
        Returns:
            dict: Updated event data or None if failed
        """
        try:
            if user_credentials:
                service = build('calendar', 'v3', credentials=user_credentials)
            elif self.service:
                service = self.service
            else:
                return None
            
            # Get existing event
            event = service.events().get(calendarId='primary', eventId=event_id).execute()
            
            # Update event details
            start_datetime = datetime.combine(booking.booking_date, booking.booking_time)
            end_datetime = start_datetime + timedelta(minutes=booking.duration)
            
            event['summary'] = f'{booking.service.name} at {booking.salon.name}'
            event['location'] = f'{booking.salon.address}, {booking.salon.city}' if booking.salon.address else booking.salon.city
            event['description'] = self._create_event_description(booking)
            event['start']['dateTime'] = start_datetime.isoformat()
            event['end']['dateTime'] = end_datetime.isoformat()
            
            # Update the event
            updated_event = service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event
            ).execute()
            
            logger.info(f"Calendar event updated: {updated_event.get('htmlLink')}")
            return updated_event
            
        except HttpError as error:
            logger.error(f"Google Calendar API error: {error}")
            return None
        except Exception as e:
            logger.error(f"Error updating calendar event: {e}")
            return None
    
    def delete_booking_event(self, event_id, user_credentials=None):
        """
        Delete a Google Calendar event
        
        Args:
            event_id: Google Calendar event ID
            user_credentials: User's Google OAuth credentials
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if user_credentials:
                service = build('calendar', 'v3', credentials=user_credentials)
            elif self.service:
                service = self.service
            else:
                return False
            
            service.events().delete(calendarId='primary', eventId=event_id).execute()
            logger.info(f"Calendar event deleted: {event_id}")
            return True
            
        except HttpError as error:
            logger.error(f"Google Calendar API error: {error}")
            return False
        except Exception as e:
            logger.error(f"Error deleting calendar event: {e}")
            return False
    
    def _create_event_description(self, booking):
        """Create a formatted description for the calendar event"""
        description = f"""
Salon Booking Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Salon: {booking.salon.name}
💇 Service: {booking.service.name}
⏱️ Duration: {booking.duration} minutes
💰 Price: ₱{booking.price}

📅 Booking ID: #{booking.id}
📧 Status: {booking.status.title()}
💳 Payment: {booking.payment_status.title()}

{f"📝 Notes: {booking.notes}" if booking.notes else ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by SalonBook
        """.strip()
        
        return description
    
    @staticmethod
    def generate_calendar_link(booking):
        """
        Generate an 'Add to Google Calendar' link
        
        Args:
            booking: Booking instance
            
        Returns:
            str: Google Calendar add event URL
        """
        from urllib.parse import urlencode
        
        start_datetime = datetime.combine(booking.booking_date, booking.booking_time)
        end_datetime = start_datetime + timedelta(minutes=booking.duration)
        
        # Format dates for Google Calendar URL
        date_format = "%Y%m%dT%H%M%S"
        start_str = start_datetime.strftime(date_format)
        end_str = end_datetime.strftime(date_format)
        
        params = {
            'action': 'TEMPLATE',
            'text': f'{booking.service.name} at {booking.salon.name}',
            'dates': f'{start_str}/{end_str}',
            'details': f'Booking #{booking.id} - {booking.service.name}\nPrice: ₱{booking.price}\nDuration: {booking.duration} minutes',
            'location': f'{booking.salon.address}, {booking.salon.city}' if booking.salon.address else booking.salon.city,
        }
        
        return f"https://calendar.google.com/calendar/render?{urlencode(params)}"
