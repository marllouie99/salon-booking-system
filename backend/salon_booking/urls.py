"""
URL configuration for salon_booking project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import TemplateView

def api_root(request):
    """API root endpoint with information about available endpoints"""
    return JsonResponse({
        'message': 'Salon Booking System API',
        'version': '1.0.0',
        'endpoints': {
            'admin': '/admin/',
            'authentication': '/api/accounts/',
            'salons': '/api/salons/',
            'bookings': '/api/bookings/',
            'notifications': '/api/notifications/',
        },
        'status': 'running'
    })

urlpatterns = [
    # Frontend routes - serve HTML templates
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('admin.html', TemplateView.as_view(template_name='admin.html'), name='admin_page'),
    path('customer-home.html', TemplateView.as_view(template_name='customer-home.html'), name='customer_home'),
    path('salon-owner-dashboard.html', TemplateView.as_view(template_name='salon-owner-dashboard.html'), name='salon_dashboard'),
    path('my-bookings.html', TemplateView.as_view(template_name='my-bookings.html'), name='my_bookings'),
    path('profile.html', TemplateView.as_view(template_name='profile.html'), name='profile'),
    path('salon-application-status.html', TemplateView.as_view(template_name='salon-application-status.html'), name='salon_application'),
    path('admin-users.html', TemplateView.as_view(template_name='admin-users.html'), name='admin_users'),
    path('admin-salons.html', TemplateView.as_view(template_name='admin-salons.html'), name='admin_salons'),
    path('admin-bookings.html', TemplateView.as_view(template_name='admin-bookings.html'), name='admin_bookings'),
    path('admin-applications.html', TemplateView.as_view(template_name='admin-applications.html'), name='admin_applications'),
    
    # API routes
    path('api/', api_root, name='api_root'),
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/salons/', include('salons.urls')),
    path('api/bookings/', include('bookings.urls')),
    path('api/notifications/', include('notifications.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
