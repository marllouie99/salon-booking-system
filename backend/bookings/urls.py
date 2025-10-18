from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_booking, name='create_booking'),
    path('my-bookings/', views.get_my_bookings, name='my_bookings'),
    path('<int:booking_id>/cancel/', views.cancel_booking, name='cancel_booking'),
    path('available-slots/<int:salon_id>/', views.get_available_slots, name='available_slots'),
    path('check-available-slots/', views.check_available_slots, name='check_available_slots'),
    path('salon-bookings/', views.get_salon_bookings, name='salon_bookings'),
    path('<int:booking_id>/update-status/', views.update_booking_status, name='update_booking_status'),
    path('<int:booking_id>/update-payment-status/', views.update_payment_status, name='update_payment_status'),
    path('salon-transactions/', views.get_salon_transactions, name='salon_transactions'),
    
    # Calendar integration
    path('<int:booking_id>/calendar-link/', views.get_calendar_link, name='get_calendar_link'),
    
    # Chat URLs
    path('chats/', views.get_user_chats, name='user_chats'),
    path('chat/<int:salon_id>/', views.get_chat_messages, name='chat_messages'),
    path('chat/<int:salon_id>/send/', views.send_message, name='send_message'),
    path('messages/<int:message_id>/read/', views.mark_message_as_read, name='mark_message_read'),
    
    # Salon chat management
    path('salon/chats/', views.get_salon_chats, name='salon_chats'),
    path('salon/chat/<int:customer_id>/', views.get_salon_chat_messages, name='salon_chat_messages'),
    path('salon/chat/<int:customer_id>/send/', views.send_salon_message, name='send_salon_message'),
    
    # Stripe payment endpoints
    path('<int:booking_id>/stripe/create-checkout/', views.create_stripe_checkout_session, name='create_stripe_checkout'),
    path('stripe/webhook/', views.stripe_webhook, name='stripe_webhook'),
    path('<int:booking_id>/stripe/verify/', views.verify_stripe_payment, name='verify_stripe_payment'),
]
