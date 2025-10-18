from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import random
from .models import User
from .utils import send_verification_email, send_password_reset_email, generate_verification_code
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from activity_logger import log_user_activity
import requests as http_requests
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

User = get_user_model()


def create_robust_google_request():
    """Create a Google Request object with retry logic and timeout"""
    session = http_requests.Session()
    
    # Configure retry strategy with DNS error handling
    retry_strategy = Retry(
        total=5,  # Increased retries for DNS issues
        backoff_factor=1,  # Wait 1, 2, 4, 8, 16 seconds between retries
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
        raise_on_status=False  # Don't raise on HTTP errors
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    
    # Pre-warm the connection to Google (helps with DNS caching)
    try:
        session.get('https://www.googleapis.com', timeout=5)
    except:
        pass  # Ignore pre-warm errors
    
    # Create Google Request with timeout and better error handling
    class GoogleRequestWithTimeout(google_requests.Request):
        def __call__(self, url, method='GET', body=None, headers=None, **kwargs):
            kwargs['timeout'] = kwargs.get('timeout', 15)  # 15 second timeout
            try:
                return super().__call__(url, method=method, body=body, headers=headers, **kwargs)
            except Exception as e:
                # If direct call fails, try again after a short delay
                import time
                time.sleep(2)
                return super().__call__(url, method=method, body=body, headers=headers, **kwargs)
    
    return GoogleRequestWithTimeout(session=session)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """Register a new user"""
    try:
        data = request.data
        
        # Extract user data
        username = data.get('email')  # Using email as username
        email = data.get('email')
        password = data.get('password')
        first_name = data.get('firstName', '')
        last_name = data.get('lastName', '')
        phone = data.get('phone', '')
        user_type = data.get('userType', 'customer')
        
        # Validation
        if not email or not password:
            return Response({
                'error': 'Email and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return Response({
                'error': 'User with this email already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Create user (inactive until email is verified)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            user_type=user_type,
            is_active=False  # User must verify email first
        )
        
        # Send verification email
        success, message = send_verification_email(user)
        
        if not success:
            # If email sending fails, still return success but with a warning
            return Response({
                'message': 'Account created but verification email could not be sent',
                'warning': message,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type
                }
            }, status=status.HTTP_201_CREATED)
        
        # Log user registration
        log_user_activity(
            user=user,
            action="USER REGISTERED",
            details={
                'user_type': user.user_type,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone': user.phone,
                'email_verification_required': True
            },
            request=request
        )

        return Response({
            'message': 'Account created successfully. Please check your email for verification code.',
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'user_type': user.user_type
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    """Login user and return JWT tokens"""
    try:
        login_input = request.data.get('email')  # This field can be email or username
        password = request.data.get('password')
        
        if not login_input or not password:
            return Response({
                'error': 'Email/Username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Try to find user by email or username
        user = None
        username = None
        
        # Check if input contains @ (email format)
        if '@' in login_input:
            # Try to find by email
            try:
                user = User.objects.get(email=login_input)
                username = user.username
            except User.DoesNotExist:
                pass
        else:
            # Try to find by username first
            try:
                user = User.objects.get(username=login_input)
                username = login_input
            except User.DoesNotExist:
                # If not found by username, try by email anyway
                try:
                    user = User.objects.get(email=login_input)
                    username = user.username
                except User.DoesNotExist:
                    pass
        
        if not user:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if email is verified
        if not user.is_email_verified and not user.is_staff:
            return Response({
                'error': 'Please verify your email before logging in',
                'email_not_verified': True
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Authenticate user
        user = authenticate(username=username, password=password)
        
        if user:
            refresh = RefreshToken.for_user(user)
            
            # Log successful login
            log_user_activity(
                user=user,
                action="USER LOGIN",
                details={
                    'user_type': user.user_type,
                    'login_method': 'email_password',
                    'is_staff': user.is_staff,
                    'last_login': user.last_login.isoformat() if user.last_login else None
                },
                request=request
            )
            
            return Response({
                'message': 'Login successful',
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type,
                    'phone': user.phone or '',
                    'address': user.address or '',
                    'profile_picture': user.profile_picture.url if user.profile_picture else None,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'Invalid email or password'
            }, status=status.HTTP_401_UNAUTHORIZED)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_all_users(request):
    """Get all users (admin only)"""
    try:
        # Check if user is admin
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({
                'error': 'Admin privileges required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        users = User.objects.all().order_by('-date_joined')
        users_data = []
        
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'user_type': user.user_type,
                'phone': user.phone,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'date_joined': user.date_joined,
                'last_login': user.last_login
            })
        
        return Response(users_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def delete_user(request, user_id):
    """Delete a user (admin only)"""
    try:
        # Check if user is admin
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({
                'error': 'Admin privileges required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Prevent deleting own account
        if request.user.id == int(user_id):
            return Response({
                'error': 'Cannot delete your own account'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find and delete user
        try:
            user = User.objects.get(id=user_id)
            user_name = f"{user.first_name} {user.last_name}"
            user.delete()
            
            return Response({
                'message': f'User "{user_name}" deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PATCH'])
def toggle_user_status(request, user_id):
    """Toggle user active status (admin only)"""
    try:
        # Check if user is admin
        if not request.user.is_staff and not request.user.is_superuser:
            return Response({
                'error': 'Admin privileges required'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Find and toggle user status
        try:
            user = User.objects.get(id=user_id)
            
            # Prevent deactivating own account
            if request.user.id == int(user_id) and user.is_active:
                return Response({
                    'error': 'Cannot deactivate your own account'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            user.is_active = not user.is_active
            user.save()
            
            action = 'activated' if user.is_active else 'deactivated'
            return Response({
                'message': f'User "{user.first_name} {user.last_name}" {action} successfully',
                'is_active': user.is_active
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email(request):
    """Verify user's email with verification code"""
    try:
        email = request.data.get('email')
        code = request.data.get('code')
        
        if not email or not code:
            return Response({
                'error': 'Email and verification code are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find user by email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already verified
        if user.is_email_verified:
            return Response({
                'message': 'Email is already verified'
            }, status=status.HTTP_200_OK)
        
        # Check if code matches
        if user.email_verification_code != code:
            return Response({
                'error': 'Invalid verification code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if code is expired
        if not user.is_verification_code_valid():
            return Response({
                'error': 'Verification code has expired. Please request a new one.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify user
        user.is_email_verified = True
        user.is_active = True  # Activate user account
        user.email_verification_code = None
        user.verification_code_expires = None
        user.save()
        
        # Generate JWT tokens for automatic login
        refresh = RefreshToken.for_user(user)
        
        # Log email verification
        log_user_activity(
            user=user,
            action="EMAIL VERIFIED",
            details={
                'user_type': user.user_type,
                'account_activated': True,
                'verification_method': 'email_code',
                'auto_login': True
            },
            request=request
        )
        
        return Response({
            'message': 'Email verified successfully! Redirecting...',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'user_type': user.user_type,
                'phone': user.phone or '',
                'address': user.address or '',
                'profile_picture': user.profile_picture.url if user.profile_picture else None,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification_code(request):
    """Resend verification code to user's email"""
    try:
        email = request.data.get('email')
        
        if not email:
            return Response({
                'error': 'Email is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find user by email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already verified
        if user.is_email_verified:
            return Response({
                'message': 'Email is already verified'
            }, status=status.HTTP_200_OK)
        
        # Send new verification email
        success, message = send_verification_email(user)
        
        if not success:
            return Response({
                'error': f'Failed to send verification email: {message}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'message': 'Verification code sent successfully. Please check your email.'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    """Login/Register with Google OAuth"""
    try:
        token = request.data.get('token')
        
        if not token:
            return Response({
                'error': 'Google token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify the token with Google
        try:
            # Get Google Client ID from settings
            google_client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', None)
            
            if not google_client_id:
                return Response({
                    'error': 'Google OAuth not configured'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Verify token with robust request handler
            try:
                google_request = create_robust_google_request()
                idinfo = id_token.verify_oauth2_token(
                    token, 
                    google_request, 
                    google_client_id
                )
            except Exception as conn_error:
                # Network connectivity issue
                error_msg = str(conn_error)
                if 'getaddrinfo failed' in error_msg or 'Max retries exceeded' in error_msg:
                    return Response({
                        'error': 'Unable to connect to Google servers. Please check your internet connection.',
                        'details': 'Network connectivity issue - ensure the server has internet access',
                        'technical_error': error_msg
                    }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                raise  # Re-raise if it's a different error
            
            # Get user info from Google
            email = idinfo.get('email')
            given_name = idinfo.get('given_name', '')
            family_name = idinfo.get('family_name', '')
            google_id = idinfo.get('sub')
            
            if not email:
                return Response({
                    'error': 'Email not provided by Google'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if user exists
            try:
                user = User.objects.get(email=email)
                # User exists, log them in
            except User.DoesNotExist:
                # Create new user
                username = email.split('@')[0] + '_' + google_id[:8]
                
                # Ensure unique username
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=given_name,
                    last_name=family_name,
                    is_email_verified=True,  # Google email is already verified
                    user_type='customer'  # Default to customer
                )
                user.set_unusable_password()  # No password for OAuth users
                user.save()
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'Login successful',
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type,
                    'phone': user.phone or '',
                    'address': user.address or '',
                    'profile_picture': user.profile_picture.url if user.profile_picture else None,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser
                }
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({
                'error': 'Invalid Google token'
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """Request password reset - send code to email"""
    try:
        email = request.data.get('email')
        
        if not email:
            return Response({
                'error': 'Email is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user exists
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # For security, don't reveal if user exists or not
            return Response({
                'success': True,
                'message': 'If an account with this email exists, you will receive a password reset code.'
            }, status=status.HTTP_200_OK)
        
        # Generate password reset code
        reset_code = generate_verification_code()
        reset_expires = timezone.now() + timedelta(minutes=15)
        
        # Save reset code to user
        user.password_reset_code = reset_code
        user.password_reset_expires = reset_expires
        user.save()
        
        # Send password reset email
        success, message = send_password_reset_email(user, reset_code)
        
        if success:
            # Log activity
            log_user_activity(
                user=user,
                action="PASSWORD RESET REQUESTED",
                details={
                    'method': 'email',
                    'code_expiry': reset_expires.isoformat()
                }
            )
            
            return Response({
                'success': True,
                'message': 'Password reset code sent to your email'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'Failed to send reset email',
                'details': message
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_reset_code(request):
    """Verify password reset code"""
    try:
        email = request.data.get('email')
        code = request.data.get('code')
        
        if not email or not code:
            return Response({
                'error': 'Email and code are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'error': 'Invalid code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if code matches and is valid
        if user.password_reset_code != code:
            return Response({
                'error': 'Invalid code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not user.is_password_reset_code_valid():
            return Response({
                'error': 'Code has expired. Please request a new one.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': True,
            'message': 'Code verified successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """Reset password with verified code"""
    try:
        email = request.data.get('email')
        code = request.data.get('code')
        new_password = request.data.get('newPassword')
        
        if not email or not code or not new_password:
            return Response({
                'error': 'Email, code, and new password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate password length
        if len(new_password) < 8:
            return Response({
                'error': 'Password must be at least 8 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Find user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({
                'error': 'Invalid request'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify code again
        if user.password_reset_code != code or not user.is_password_reset_code_valid():
            return Response({
                'error': 'Invalid or expired code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Reset password
        user.set_password(new_password)
        user.password_reset_code = None
        user.password_reset_expires = None
        user.save()
        
        # Log activity
        log_user_activity(
            user=user,
            action="PASSWORD RESET COMPLETED",
            details={
                'method': 'email_verification',
                'timestamp': timezone.now().isoformat()
            }
        )
        
        return Response({
            'success': True,
            'message': 'Password reset successfully. You can now login with your new password.'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Update user profile information"""
    try:
        user = request.user
        
        # Update allowed fields
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        if 'phone' in request.data:
            user.phone = request.data['phone']
        if 'address' in request.data:
            user.address = request.data['address']
        
        user.save()
        
        # Log activity
        log_user_activity(
            user=user,
            action="PROFILE UPDATED",
            details={
                'updated_fields': list(request.data.keys())
            },
            request=request
        )
        
        return Response({
            'message': 'Profile updated successfully',
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'user_type': user.user_type,
                'phone': user.phone or '',
                'address': user.address or '',
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change user password"""
    try:
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response({
                'error': 'Both current and new password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify current password
        if not user.check_password(current_password):
            return Response({
                'error': 'Current password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate new password length
        if len(new_password) < 8:
            return Response({
                'error': 'New password must be at least 8 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        # Log activity
        log_user_activity(
            user=user,
            action="PASSWORD CHANGED",
            details={
                'method': 'profile_settings'
            },
            request=request
        )
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_avatar(request):
    """Upload user avatar"""
    try:
        user = request.user
        
        if 'avatar' not in request.FILES:
            return Response({
                'error': 'No avatar file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        avatar = request.FILES['avatar']
        
        # Validate file size (max 5MB)
        if avatar.size > 5 * 1024 * 1024:
            return Response({
                'error': 'Avatar file size must be less than 5MB'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']
        if avatar.content_type not in allowed_types:
            return Response({
                'error': 'Only JPEG, PNG, and GIF images are allowed'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Save avatar to user profile
        user.profile_picture = avatar
        user.save()
        
        # Log activity
        log_user_activity(
            user=user,
            action="AVATAR UPDATED",
            details={
                'file_name': avatar.name,
                'file_size': avatar.size
            },
            request=request
        )
        
        return Response({
            'message': 'Avatar uploaded successfully',
            'avatar_url': user.profile_picture.url if user.profile_picture else None,
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'profile_picture': user.profile_picture.url if user.profile_picture else None
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_preferences(request):
    """Update user preferences"""
    try:
        user = request.user
        
        # Log activity
        log_user_activity(
            user=user,
            action="PREFERENCES UPDATED",
            details={
                'preferences': request.data
            },
            request=request
        )
        
        return Response({
            'message': 'Preferences updated successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Delete user account"""
    try:
        user = request.user
        
        # Log activity before deletion
        log_user_activity(
            user=user,
            action="ACCOUNT DELETED",
            details={
                'user_type': user.user_type,
                'email': user.email
            },
            request=request
        )
        
        # Delete user account
        user.delete()
        
        return Response({
            'message': 'Account deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
