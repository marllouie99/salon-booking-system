from rest_framework import serializers
from .models import Salon, Service, Review
from django.contrib.auth import get_user_model

User = get_user_model()


class ReviewSerializer(serializers.ModelSerializer):
    """Serializer for Review model"""
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.ReadOnlyField(source='customer.email')
    salon_name = serializers.ReadOnlyField(source='salon.name')
    can_edit = serializers.SerializerMethodField()
    can_respond = serializers.SerializerMethodField()
    
    class Meta:
        model = Review
        fields = [
            'id', 'salon', 'salon_name', 'customer', 'customer_name', 'customer_email',
            'booking', 'rating', 'title', 'comment',
            'service_quality', 'cleanliness', 'value_for_money', 'staff_friendliness',
            'status', 'is_verified_booking', 'helpful_count',
            'salon_response', 'salon_response_date',
            'created_at', 'updated_at', 'can_edit', 'can_respond'
        ]
        read_only_fields = [
            'customer', 'status', 'is_verified_booking', 'helpful_count',
            'salon_response_date', 'created_at', 'updated_at'
        ]
    
    def get_customer_name(self, obj):
        """Return customer's full name or email"""
        if obj.customer.first_name and obj.customer.last_name:
            return f"{obj.customer.first_name} {obj.customer.last_name}"
        return obj.customer.email.split('@')[0]
    
    def get_can_edit(self, obj):
        """Check if current user can edit this review"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.customer == request.user
    
    def get_can_respond(self, obj):
        """Check if current user can respond to this review"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # Salon owner can respond
        return obj.salon.owner == request.user or request.user.is_staff


class ReviewCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating reviews"""
    
    class Meta:
        model = Review
        fields = [
            'salon', 'booking', 'rating', 'title', 'comment',
            'service_quality', 'cleanliness', 'value_for_money', 'staff_friendliness'
        ]
    
    def validate(self, data):
        """Validate review data"""
        # Check if user already reviewed this salon with this booking
        request = self.context.get('request')
        salon = data.get('salon')
        booking = data.get('booking')
        
        if booking:
            # Check if booking belongs to the user
            if booking.customer != request.user:
                raise serializers.ValidationError("You can only review your own bookings.")
            
            # Check if booking is completed
            if booking.status != 'completed':
                raise serializers.ValidationError("You can only review completed bookings.")
            
            # Check if booking's salon matches
            if booking.salon != salon:
                raise serializers.ValidationError("Booking salon doesn't match the selected salon.")
            
            # Check if review already exists for this booking
            if hasattr(booking, 'review'):
                raise serializers.ValidationError("You have already reviewed this booking.")
        
        # Validate rating
        rating = data.get('rating')
        if rating < 1 or rating > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        
        return data
    
    def create(self, validated_data):
        """Create review with current user as customer"""
        validated_data['customer'] = self.context['request'].user
        return super().create(validated_data)


class SalonResponseSerializer(serializers.Serializer):
    """Serializer for salon owner responding to review"""
    salon_response = serializers.CharField(max_length=1000, required=True)
