from django.urls import path
from . import views

urlpatterns = [
    path('', views.get_all_salons, name='get_all_salons'),
    path('apply/', views.submit_salon_application, name='submit_salon_application'),
    path('applications/my/', views.get_my_application, name='get_my_application'),
    path('applications/', views.get_all_applications, name='get_all_applications'),
    path('applications/<int:application_id>/approve/', views.approve_application, name='approve_application'),
    path('applications/<int:application_id>/reject/', views.reject_application, name='reject_application'),
    
    # Search and filtering
    path('search/', views.search_salons, name='search_salons'),
    path('filter/', views.filter_salons, name='filter_salons'),
    path('nearby/', views.nearby_salons, name='nearby_salons'),
    
    # Service management
    path('services/', views.manage_services, name='manage_services'),
    path('services/<int:service_id>/', views.manage_service, name='manage_service'),
    path('<int:salon_id>/services/', views.get_salon_services, name='get_salon_services'),
    
    # Salon profile management
    path('profile/', views.update_salon_profile, name='update_salon_profile'),
    path('upload-logo/', views.upload_salon_logo, name='upload_salon_logo'),
    path('upload-cover/', views.upload_salon_cover, name='upload_salon_cover'),
    
    # Review management
    path('<int:salon_id>/reviews/', views.salon_reviews, name='salon_reviews'),
    path('reviews/<int:review_id>/', views.review_detail, name='review_detail'),
    path('reviews/<int:review_id>/respond/', views.respond_to_review, name='respond_to_review'),
    path('reviews/<int:review_id>/helpful/', views.mark_review_helpful, name='mark_review_helpful'),
    path('reviews/my/', views.my_reviews, name='my_reviews'),
    path('reviews/pending/', views.pending_reviews, name='pending_reviews'),
    path('reviews/<int:review_id>/moderate/', views.moderate_review, name='moderate_review'),
]
