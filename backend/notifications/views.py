from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Notification
from .serializers import NotificationSerializer, NotificationCreateSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user notifications
    
    Endpoints:
    - GET /api/notifications/ - List user's notifications
    - GET /api/notifications/{id}/ - Get specific notification
    - POST /api/notifications/{id}/mark_read/ - Mark notification as read
    - POST /api/notifications/mark_all_read/ - Mark all notifications as read
    - DELETE /api/notifications/{id}/ - Delete notification
    - GET /api/notifications/unread_count/ - Get count of unread notifications
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        """Return notifications for the current user only"""
        return Notification.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        """Use different serializer for create action"""
        if self.action == 'create':
            return NotificationCreateSerializer
        return NotificationSerializer
    
    def list(self, request, *args, **kwargs):
        """
        List notifications with optional filters
        Query params:
        - is_read: Filter by read status (true/false)
        - notification_type: Filter by type
        - limit: Limit number of results
        """
        queryset = self.get_queryset()
        
        # Filter by read status
        is_read = request.query_params.get('is_read', None)
        if is_read is not None:
            is_read_bool = is_read.lower() == 'true'
            queryset = queryset.filter(is_read=is_read_bool)
        
        # Filter by notification type
        notification_type = request.query_params.get('notification_type', None)
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        # Limit results
        limit = request.query_params.get('limit', None)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except ValueError:
                pass
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a specific notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        serializer = self.get_serializer(notification)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all user's notifications as read"""
        updated_count = Notification.objects.filter(
            user=request.user,
            is_read=False
        ).update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({
            'success': True,
            'message': f'{updated_count} notifications marked as read',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = Notification.objects.filter(
            user=request.user,
            is_read=False
        ).count()
        
        return Response({
            'unread_count': count
        })
    
    @action(detail=False, methods=['delete'])
    def clear_read(self, request):
        """Delete all read notifications"""
        deleted_count, _ = Notification.objects.filter(
            user=request.user,
            is_read=True
        ).delete()
        
        return Response({
            'success': True,
            'message': f'{deleted_count} read notifications deleted',
            'deleted_count': deleted_count
        })
    
    def destroy(self, request, *args, **kwargs):
        """Delete a specific notification"""
        notification = self.get_object()
        notification.delete()
        return Response({
            'success': True,
            'message': 'Notification deleted'
        }, status=status.HTTP_204_NO_CONTENT)
