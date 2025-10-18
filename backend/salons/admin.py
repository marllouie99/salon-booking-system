from django.contrib import admin
from .models import SalonApplication, Salon, Service, ServiceImage, Review


@admin.register(SalonApplication)
class SalonApplicationAdmin(admin.ModelAdmin):
    list_display = ['salon_name', 'user', 'status', 'city', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['salon_name', 'user__email', 'business_email', 'city']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Applicant Information', {
            'fields': ('user',)
        }),
        ('Salon Information', {
            'fields': ('salon_name', 'business_email', 'phone', 'website')
        }),
        ('Location', {
            'fields': ('address', 'city', 'state', 'postal_code')
        }),
        ('Details', {
            'fields': ('description', 'services', 'years_in_business', 'staff_count', 'application_reason')
        }),
        ('Review', {
            'fields': ('status', 'admin_notes', 'reviewed_by', 'reviewed_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Salon)
class SalonAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'city', 'rating', 'is_active', 'is_verified', 'created_at']
    list_filter = ['is_active', 'is_featured', 'is_verified', 'created_at']
    search_fields = ['name', 'owner__email', 'city', 'email']
    readonly_fields = ['created_at', 'updated_at', 'rating', 'total_reviews']
    
    fieldsets = (
        ('Owner Information', {
            'fields': ('owner', 'application')
        }),
        ('Basic Information', {
            'fields': ('name', 'email', 'phone', 'website')
        }),
        ('Location', {
            'fields': ('address', 'city', 'state', 'postal_code', 'latitude', 'longitude')
        }),
        ('Details', {
            'fields': ('description', 'services', 'years_in_business', 'staff_count')
        }),
        ('Media', {
            'fields': ('logo', 'cover_image')
        }),
        ('Stats', {
            'fields': ('rating', 'total_reviews')
        }),
        ('Status', {
            'fields': ('is_active', 'is_featured', 'is_verified')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


class ServiceImageInline(admin.TabularInline):
    model = ServiceImage
    extra = 1
    fields = ['image', 'is_primary', 'created_at']
    readonly_fields = ['created_at']


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'salon', 'price', 'duration', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'salon__name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ServiceImageInline]
    
    fieldsets = (
        ('Service Information', {
            'fields': ('salon', 'name', 'description')
        }),
        ('Pricing', {
            'fields': ('price', 'duration')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['customer', 'salon', 'rating', 'status', 'is_verified_booking', 'created_at']
    list_filter = ['status', 'rating', 'is_verified_booking', 'created_at']
    search_fields = ['customer__email', 'salon__name', 'title', 'comment']
    readonly_fields = ['created_at', 'updated_at', 'helpful_count', 'is_verified_booking']
    
    fieldsets = (
        ('Review Information', {
            'fields': ('salon', 'customer', 'booking')
        }),
        ('Rating & Comment', {
            'fields': ('rating', 'title', 'comment')
        }),
        ('Detailed Ratings', {
            'fields': ('service_quality', 'cleanliness', 'value_for_money', 'staff_friendliness'),
            'classes': ('collapse',)
        }),
        ('Moderation', {
            'fields': ('status', 'is_verified_booking', 'moderated_by', 'moderation_notes')
        }),
        ('Salon Response', {
            'fields': ('salon_response', 'salon_response_date'),
            'classes': ('collapse',)
        }),
        ('Engagement', {
            'fields': ('helpful_count',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    actions = ['approve_reviews', 'reject_reviews']
    
    def approve_reviews(self, request, queryset):
        updated = queryset.update(status='approved', moderated_by=request.user)
        self.message_user(request, f'{updated} review(s) approved successfully.')
    approve_reviews.short_description = 'Approve selected reviews'
    
    def reject_reviews(self, request, queryset):
        updated = queryset.update(status='rejected', moderated_by=request.user)
        self.message_user(request, f'{updated} review(s) rejected.')
    reject_reviews.short_description = 'Reject selected reviews'
