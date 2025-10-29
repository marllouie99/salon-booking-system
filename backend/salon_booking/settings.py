"""
Django settings for salon_booking project.
"""

import os
from pathlib import Path
from decouple import config
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='your-secret-key-here-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

# Parse ALLOWED_HOSTS from environment variable (comma-separated)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

# Add Railway domain if deployed
RAILWAY_STATIC_URL = config('RAILWAY_STATIC_URL', default='')
if RAILWAY_STATIC_URL:
    # Extract domain without scheme for ALLOWED_HOSTS
    domain = RAILWAY_STATIC_URL.replace('https://', '').replace('http://', '')
    ALLOWED_HOSTS.append(domain)

# Auto-detect Railway public domain
RAILWAY_PUBLIC_DOMAIN = config('RAILWAY_PUBLIC_DOMAIN', default='')
if RAILWAY_PUBLIC_DOMAIN:
    ALLOWED_HOSTS.append(RAILWAY_PUBLIC_DOMAIN)

# CSRF Trusted Origins
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://salon-booking-system-production-4fb1.up.railway.app',  # Railway frontend
    'https://web-production-e6265.up.railway.app',  # Railway backend
]

# Add Railway public domain to CSRF trusted origins (with https://)
if RAILWAY_PUBLIC_DOMAIN:
    # Ensure it has a scheme
    if not RAILWAY_PUBLIC_DOMAIN.startswith(('http://', 'https://')):
        CSRF_TRUSTED_ORIGINS.append(f'https://{RAILWAY_PUBLIC_DOMAIN}')
    else:
        CSRF_TRUSTED_ORIGINS.append(RAILWAY_PUBLIC_DOMAIN)
    
# Add Railway static URL to CSRF trusted origins (with https://)
if RAILWAY_STATIC_URL:
    # Ensure it has a scheme
    if not RAILWAY_STATIC_URL.startswith(('http://', 'https://')):
        CSRF_TRUSTED_ORIGINS.append(f'https://{RAILWAY_STATIC_URL}')
    else:
        CSRF_TRUSTED_ORIGINS.append(RAILWAY_STATIC_URL)

# Add Vercel frontend URL to CSRF trusted origins if set
FRONTEND_URL_CONFIG = config('FRONTEND_URL', default='http://localhost:3000')
if FRONTEND_URL_CONFIG and FRONTEND_URL_CONFIG not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL_CONFIG)

# Frontend URL for redirects (payment success, email links, etc.)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
    'cloudinary_storage',
    'cloudinary',
    
    # Local apps
    'accounts',
    'salons',
    'bookings',
    'notifications',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Re-enabled - MUST be first
    'salon_booking.middleware.SecurityHeadersMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # For serving static files in production
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'salon_booking.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'salon_booking.wsgi.application'

# Database configuration
# ============================================
# DATABASE CONFIGURATION
# ============================================
# Use Railway's DATABASE_URL if available, otherwise use individual variables
DATABASE_URL = config('DATABASE_URL', default='')

if DATABASE_URL:
    # Railway PostgreSQL (recommended for deployment)
    DATABASES = {
        'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    }
else:
    # Supabase or custom PostgreSQL
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DATABASE_NAME', default='postgres'),
            'USER': config('DATABASE_USER', default='postgres'),
            'PASSWORD': config('DATABASE_PASSWORD', default=''),
            'HOST': config('DATABASE_HOST', default='localhost'),
            'PORT': config('DATABASE_PORT', default='5432'),
            'OPTIONS': {
                'sslmode': 'require',
            },
            'CONN_MAX_AGE': 600,
        }
    }

# ============================================
# SQLITE (BACKUP) - Uncomment to switch back to SQLite
# ============================================
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.sqlite3',
#         'NAME': BASE_DIR / 'db.sqlite3',
#     }
# }

# ============================================
# MYSQL - Alternative configuration
# ============================================
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.mysql',
#         'NAME': config('DB_NAME', default='salon_booking'),
#         'USER': config('DB_USER', default='root'),
#         'PASSWORD': config('DB_PASSWORD', default=''),
#         'HOST': config('DB_HOST', default='localhost'),
#         'PORT': config('DB_PORT', default='3306'),
#         'OPTIONS': {
#             'sql_mode': 'traditional',
#         }
#     }
# }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'  # GMT+8 Philippine Time
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise configuration for serving static files in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Cloudinary Configuration for Media Storage
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': config('CLOUDINARY_CLOUD_NAME', default=''),
    'API_KEY': config('CLOUDINARY_API_KEY', default=''),
    'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
    'PREFIX': 'salon-booking',  # Folder prefix in Cloudinary
}

# Use Cloudinary for media files in production, local filesystem in development
if not DEBUG:
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
    # Cloudinary handles URLs, no MEDIA_URL needed
else:
    # Local development - use filesystem
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'

# Ensure correct HTTPS scheme behind proxies (e.g., Railway)
# This helps request.build_absolute_uri() generate https:// URLs
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = False  # Disabled for CORS testing

# Disable security middleware COOP header (conflicts with our custom one)
SECURE_CROSS_ORIGIN_OPENER_POLICY = None

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20
}

# CORS settings - Simplified and explicit
CORS_ALLOW_ALL_ORIGINS = True  # Allow all origins for now
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_PREFLIGHT_MAX_AGE = 86400  # Cache preflight for 24 hours

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

AUTH_USER_MODEL = 'accounts.User'

# Email Configuration
# Use Brevo (formerly Sendinblue) for reliable email delivery
BREVO_API_KEY = config('BREVO_API_KEY', default='')

if BREVO_API_KEY:
    # Brevo SMTP configuration
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = 'smtp-relay.brevo.com'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='marllouie4@gmail.com')
    EMAIL_HOST_PASSWORD = BREVO_API_KEY  # Brevo uses API key as password
    DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='marllouie4@gmail.com')
    EMAIL_TIMEOUT = 10
else:
    # Fallback to Gmail (for local development)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
    EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
    EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
    EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
    EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
    DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='marllouie4@gmail.com')
    EMAIL_TIMEOUT = 10

# Google OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID = config('GOOGLE_OAUTH_CLIENT_ID', default='')
GOOGLE_OAUTH_CLIENT_SECRET = config('GOOGLE_OAUTH_CLIENT_SECRET', default='')

# PayPal Configuration
PAYPAL_MODE = config('PAYPAL_MODE', default='sandbox')  # sandbox or live
PAYPAL_CLIENT_ID = config('PAYPAL_CLIENT_ID', default='')
PAYPAL_CLIENT_SECRET = config('PAYPAL_CLIENT_SECRET', default='')

# Stripe Configuration
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
STRIPE_WEBHOOK_SECRET = config('STRIPE_WEBHOOK_SECRET', default='')
