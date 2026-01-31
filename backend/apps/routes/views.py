"""
Views for routes app - Route tracking and GPS coordinates
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Avg, Count
from .models import RouteSession, RouteTracking
from .serializers import (
    RouteSessionSerializer, RouteTrackingSerializer,
    RouteSessionCreateSerializer, RouteSessionStopSerializer,
    CoordinateSerializer, ShipmentEventSerializer
)

logger = logging.getLogger(__name__)


class RouteSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for route sessions"""
    queryset = RouteSession.objects.all()
    serializer_class = RouteSessionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter sessions by employee"""
        queryset = super().get_queryset()
        user = self.request.user
        
        # Admins/managers see all, drivers see only their own
        if not (user.is_superuser or user.is_ops_team or user.is_staff):
            if user.employee_id:
                queryset = queryset.filter(employee_id=user.employee_id)
        
        return queryset.order_by('-start_time')
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start a new route session"""
        serializer = RouteSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        session_id = f'sess-{int(timezone.now().timestamp() * 1000)}-{user.employee_id}'
        
        session = RouteSession.objects.create(
            id=session_id,
            employee_id=user.employee_id,
            start_latitude=serializer.validated_data['start_latitude'],
            start_longitude=serializer.validated_data['start_longitude'],
            shipment_id=serializer.validated_data.get('shipment_id'),
            start_time=timezone.now(),
            status='active'
        )
        
        logger.info(f'Route session started: {session_id} by {user.employee_id}')
        
        return Response({
            'success': True,
            'session': RouteSessionSerializer(session).data,
            'message': 'Route session started successfully'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def stop(self, request):
        """Stop a route session"""
        serializer = RouteSessionStopSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            session = RouteSession.objects.get(
                id=serializer.validated_data['session_id'],
                employee_id=request.user.employee_id
            )
        except RouteSession.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        session.end_latitude = serializer.validated_data['end_latitude']
        session.end_longitude = serializer.validated_data['end_longitude']
        session.end_time = timezone.now()
        session.status = 'completed'
        
        # Calculate total time
        if session.start_time and session.end_time:
            delta = session.end_time - session.start_time
            session.total_time = int(delta.total_seconds())
        
        # Calculate total distance from tracking points
        tracking_points = session.tracking_points.all()
        if tracking_points.count() > 1:
            # Simple distance calculation (can be improved with Haversine formula)
            total_distance = 0
            prev_point = None
            for point in tracking_points.order_by('timestamp'):
                if prev_point:
                    # Calculate distance between points
                    import math
                    lat1, lon1 = prev_point.latitude, prev_point.longitude
                    lat2, lon2 = point.latitude, point.longitude
                    # Haversine formula
                    R = 6371  # Earth radius in km
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                    c = 2 * math.asin(math.sqrt(a))
                    total_distance += R * c
                prev_point = point
            session.total_distance = total_distance
        
        session.save()
        
        logger.info(f'Route session stopped: {session.id}')
        
        return Response({
            'success': True,
            'session': RouteSessionSerializer(session).data,
            'message': 'Route session stopped successfully'
        })
    
    @action(detail=False, methods=['post'])
    def coordinates(self, request):
        """Submit GPS coordinates"""
        serializer = CoordinateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            session = RouteSession.objects.get(
                id=serializer.validated_data['session_id'],
                employee_id=user.employee_id
            )
        except RouteSession.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        tracking = RouteTracking.objects.create(
            session=session,
            employee_id=user.employee_id,
            latitude=serializer.validated_data['latitude'],
            longitude=serializer.validated_data['longitude'],
            timestamp=serializer.validated_data.get('timestamp') or timezone.now(),
            accuracy=serializer.validated_data.get('accuracy'),
            speed=serializer.validated_data.get('speed'),
            event_type='gps'
        )
        
        return Response({
            'success': True,
            'record': RouteTrackingSerializer(tracking).data,
            'message': 'GPS coordinate recorded successfully'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def coordinates_batch(self, request):
        """Batch submit GPS coordinates"""
        coordinates = request.data.get('coordinates', [])
        if not isinstance(coordinates, list):
            return Response(
                {'success': False, 'message': 'Coordinates must be an array'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        results = []
        for coord_data in coordinates:
            serializer = CoordinateSerializer(data=coord_data)
            if serializer.is_valid():
                try:
                    session = RouteSession.objects.get(
                        id=serializer.validated_data['session_id'],
                        employee_id=user.employee_id
                    )
                    tracking = RouteTracking.objects.create(
                        session=session,
                        employee_id=user.employee_id,
                        latitude=serializer.validated_data['latitude'],
                        longitude=serializer.validated_data['longitude'],
                        timestamp=serializer.validated_data.get('timestamp') or timezone.now(),
                        accuracy=serializer.validated_data.get('accuracy'),
                        speed=serializer.validated_data.get('speed')
                    )
                    results.append({
                        'success': True,
                        'record': RouteTrackingSerializer(tracking).data
                    })
                except RouteSession.DoesNotExist:
                    results.append({
                        'success': False,
                        'error': 'Session not found'
                    })
            else:
                results.append({
                    'success': False,
                    'error': serializer.errors
                })
        
        return Response({
            'success': True,
            'results': results,
            'message': f'Processed {len(results)} coordinates'
        })
    
    @action(detail=False, methods=['post'])
    def shipment_event(self, request):
        """Record shipment event (pickup/delivery)"""
        serializer = ShipmentEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            session = RouteSession.objects.get(
                id=serializer.validated_data['session_id'],
                employee_id=user.employee_id
            )
        except RouteSession.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create tracking point for event
        tracking = RouteTracking.objects.create(
            session=session,
            employee_id=user.employee_id,
            latitude=serializer.validated_data['latitude'],
            longitude=serializer.validated_data['longitude'],
            timestamp=timezone.now(),
            event_type=serializer.validated_data['event_type'],
            shipment_id=serializer.validated_data['shipment_id']
        )
        
        # Update shipment status if needed
        from apps.shipments.models import Shipment
        try:
            shipment = Shipment.objects.get(id=serializer.validated_data['shipment_id'])
            if serializer.validated_data['event_type'] == 'delivery':
                shipment.status = 'Delivered'
                shipment.actual_delivery_time = timezone.now()
            elif serializer.validated_data['event_type'] == 'pickup':
                shipment.status = 'Picked Up'
            shipment.save()
        except Shipment.DoesNotExist:
            pass
        
        logger.info(f'Shipment event recorded: {serializer.validated_data["event_type"]} for {serializer.validated_data["shipment_id"]}')
        
        return Response({
            'success': True,
            'record': RouteTrackingSerializer(tracking).data,
            'message': 'Shipment event recorded and coordinates updated'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def session(self, request, pk=None):
        """Get session data"""
        try:
            session = RouteSession.objects.get(id=pk)
            # Check permissions
            user = request.user
            if not (user.is_superuser or user.is_ops_team or user.is_staff):
                if session.employee_id != user.employee_id:
                    return Response(
                        {'success': False, 'message': 'Access denied'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            return Response({
                'success': True,
                'session': RouteSessionSerializer(session).data
            })
        except RouteSession.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['post'])
    def sync_session(self, request):
        """Sync offline route session"""
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        session_id = request.data.get('id')
        if not session_id:
            return Response(
                {'success': False, 'message': 'Session ID required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or update session
        session, created = RouteSession.objects.get_or_create(
            id=session_id,
            defaults={
                'employee_id': user.employee_id,
                'start_latitude': request.data.get('startLatitude'),
                'start_longitude': request.data.get('startLongitude'),
                'shipment_id': request.data.get('shipmentId'),
                'start_time': timezone.now(),
                'status': 'active'
            }
        )
        
        # If session exists and has end time, stop it
        if request.data.get('status') == 'completed' or request.data.get('endTime'):
            session.end_latitude = request.data.get('endLatitude')
            session.end_longitude = request.data.get('endLongitude')
            session.end_time = timezone.now()
            session.status = 'completed'
            session.save()
        
        return Response({
            'success': True,
            'session': RouteSessionSerializer(session).data,
            'message': 'Session synced'
        })
    
    @action(detail=False, methods=['post'])
    def sync_coordinates(self, request):
        """Sync offline coordinates"""
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        session_id = request.data.get('sessionId')
        coordinates = request.data.get('coordinates', [])
        
        if not session_id:
            return Response(
                {'success': False, 'message': 'Session ID required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            session = RouteSession.objects.get(id=session_id, employee_id=user.employee_id)
        except RouteSession.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        results = []
        for coord_data in coordinates:
            tracking = RouteTracking.objects.create(
                session=session,
                employee_id=user.employee_id,
                latitude=float(coord_data.get('latitude', 0)),
                longitude=float(coord_data.get('longitude', 0)),
                timestamp=timezone.now(),
                accuracy=coord_data.get('accuracy'),
                speed=coord_data.get('speed')
            )
            results.append(RouteTrackingSerializer(tracking).data)
        
        logger.info(f'Offline coordinates synced for session {session_id}: {len(results)}')
        
        return Response({
            'success': True,
            'results': results,
            'message': 'Coordinates synced'
        })
    
    @action(detail=False, methods=['post'])
    def track_location(self, request):
        """Track user location in real-time"""
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        accuracy = request.data.get('accuracy')
        speed = request.data.get('speed')
        session_id = request.data.get('session_id')
        
        if not latitude or not longitude:
            return Response(
                {'success': False, 'message': 'Latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .services import location_tracking
        tracking = location_tracking.track_location(
            user.employee_id,
            float(latitude),
            float(longitude),
            accuracy=float(accuracy) if accuracy else None,
            speed=float(speed) if speed else None,
            session_id=session_id
        )
        
        if tracking:
            return Response({
                'success': True,
                'location': RouteTrackingSerializer(tracking).data,
                'message': 'Location tracked successfully'
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(
                {'success': False, 'message': 'Failed to track location'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def current_location(self, request):
        """Get current location of authenticated user"""
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        from .services import location_tracking
        location = location_tracking.get_user_current_location(user.employee_id)
        
        if location:
            return Response({
                'success': True,
                'location': location
            })
        else:
            return Response(
                {'success': False, 'message': 'No location data found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def active_riders(self, request):
        """Get locations of all active riders (admin/manager only)"""
        user = request.user
        if not (user.is_superuser or user.is_ops_team or user.is_staff):
            return Response(
                {'success': False, 'message': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from .services import location_tracking
        locations = location_tracking.get_active_riders_locations()
        
        return Response({
            'success': True,
            'riders': locations,
            'count': len(locations)
        })
