from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from .models import Booking, Transaction, Chat, Message


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['customer_name', 'salon', 'service', 'booking_date', 'booking_time', 'status', 'payment_status', 'price', 'created_at']
    list_filter = ['status', 'payment_status', 'booking_date', 'created_at', 'salon']
    search_fields = ['customer_name', 'customer_email', 'salon__name', 'service__name', 'paypal_order_id']
    readonly_fields = ['created_at', 'updated_at', 'total_amount']
    
    fieldsets = (
        ('Customer Information', {
            'fields': ('customer', 'customer_name', 'customer_email', 'customer_phone')
        }),
        ('Booking Details', {
            'fields': ('salon', 'service', 'booking_date', 'booking_time', 'duration', 'notes')
        }),
        ('Pricing & Status', {
            'fields': ('price', 'total_amount', 'status', 'payment_status', 'payment_id', 'paypal_order_id')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('customer', 'salon', 'service')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = [
        'transaction_id_display', 'customer_info', 'salon_info', 'transaction_type', 
        'amount_display', 'status', 'payment_method', 'created_at'
    ]
    list_filter = [
        'transaction_type', 'status', 'payment_method', 'currency', 
        'created_at', 'salon', 'booking__service'
    ]
    search_fields = [
        'customer__email', 'customer__first_name', 'customer__last_name',
        'salon__name', 'payment_provider_id', 'payment_provider_transaction_id',
        'booking__customer_name'
    ]
    readonly_fields = [
        'created_at', 'updated_at', 'net_amount_display', 'booking_link'
    ]
    
    fieldsets = (
        ('Transaction Details', {
            'fields': ('booking_link', 'transaction_type', 'amount', 'currency', 'status')
        }),
        ('Parties Involved', {
            'fields': ('customer', 'salon')
        }),
        ('Payment Information', {
            'fields': ('payment_method', 'payment_provider_id', 'payment_provider_transaction_id')
        }),
        ('Financial Breakdown', {
            'fields': ('platform_fee', 'salon_payout', 'net_amount_display'),
            'classes': ['collapse']
        }),
        ('Additional Information', {
            'fields': ('description', 'processed_at', 'metadata'),
            'classes': ['collapse']
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ['collapse']
        }),
    )
    
    # Custom display methods
    def transaction_id_display(self, obj):
        return f"TXN-{obj.id:06d}"
    transaction_id_display.short_description = 'Transaction ID'
    
    def customer_info(self, obj):
        return format_html(
            '<strong>{}</strong><br><small>{}</small>',
            obj.customer.get_full_name() or obj.customer.email,
            obj.customer.email
        )
    customer_info.short_description = 'Customer'
    
    def salon_info(self, obj):
        return format_html(
            '<strong>{}</strong><br><small>{}, {}</small>',
            obj.salon.name,
            obj.salon.city,
            obj.salon.state or ''
        )
    salon_info.short_description = 'Salon'
    
    def amount_display(self, obj):
        color = 'green' if obj.status == 'completed' else 'orange' if obj.status == 'pending' else 'red'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color,
            obj.currency,
            obj.amount
        )
    amount_display.short_description = 'Amount'
    
    def net_amount_display(self, obj):
        return f"{obj.currency} {obj.net_amount:.2f}"
    net_amount_display.short_description = 'Net Amount (After Fees)'
    
    def booking_link(self, obj):
        if obj.booking:
            url = reverse('admin:bookings_booking_change', args=[obj.booking.id])
            return format_html('<a href="{}" target="_blank">View Booking #{}</a>', url, obj.booking.id)
        return '-'
    booking_link.short_description = 'Related Booking'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'customer', 'salon', 'booking', 'booking__service'
        )
    
    # Custom actions
    actions = ['mark_as_completed', 'mark_as_failed', 'calculate_fees']
    
    def mark_as_completed(self, request, queryset):
        updated = queryset.update(status='completed')
        self.message_user(request, f'{updated} transactions marked as completed.')
    mark_as_completed.short_description = 'Mark selected transactions as completed'
    
    def mark_as_failed(self, request, queryset):
        updated = queryset.update(status='failed')
        self.message_user(request, f'{updated} transactions marked as failed.')
    mark_as_failed.short_description = 'Mark selected transactions as failed'
    
    def calculate_fees(self, request, queryset):
        updated = 0
        for transaction in queryset:
            transaction.calculate_platform_fee()
            transaction.save()
            updated += 1
        self.message_user(request, f'Platform fees calculated for {updated} transactions.')
    calculate_fees.short_description = 'Calculate platform fees for selected transactions'


class MessageInline(admin.TabularInline):
    model = Message
    fields = ['sender_type', 'message_type', 'content', 'sent_at', 'is_read']
    readonly_fields = ['sent_at']
    extra = 0
    ordering = ['-sent_at']


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ['customer', 'salon', 'created_at', 'last_message_preview', 'unread_count_customer', 'unread_count_salon', 'is_active']
    list_filter = ['is_active', 'created_at', 'salon']
    search_fields = ['customer__email', 'customer__first_name', 'customer__last_name', 'salon__name']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [MessageInline]
    
    fieldsets = (
        ('Chat Information', {
            'fields': ('customer', 'salon', 'booking', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    def last_message_preview(self, obj):
        if obj.last_message:
            content = obj.last_message.content[:50]
            return f"{obj.last_message.sender_type}: {content}..."
        return 'No messages yet'
    last_message_preview.short_description = 'Last Message'
    
    def unread_count_customer(self, obj):
        count = obj.unread_count_for_customer
        if count > 0:
            return format_html('<span style="color: #dc3545; font-weight: bold;">{}</span>', count)
        return 0
    unread_count_customer.short_description = 'Unread (Customer)'
    
    def unread_count_salon(self, obj):
        count = obj.unread_count_for_salon
        if count > 0:
            return format_html('<span style="color: #dc3545; font-weight: bold;">{}</span>', count)
        return 0
    unread_count_salon.short_description = 'Unread (Salon)'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['chat', 'sender_type', 'message_type', 'content_preview', 'sent_at', 'is_read']
    list_filter = ['sender_type', 'message_type', 'is_read', 'sent_at']
    search_fields = ['content', 'chat__customer__email', 'chat__salon__name']
    readonly_fields = ['sent_at', 'read_at']
    
    fieldsets = (
        ('Message Information', {
            'fields': ('chat', 'sender_type', 'message_type', 'content')
        }),
        ('Status', {
            'fields': ('is_read', 'read_at', 'related_booking', 'metadata')
        }),
        ('Timestamps', {
            'fields': ('sent_at',),
            'classes': ('collapse',)
        })
    )
    
    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Content Preview'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('chat', 'chat__customer', 'chat__salon')
