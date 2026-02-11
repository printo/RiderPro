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
    CoordinateSerializer, ShipmentEventSerializer,
    RouteOptimizeRequestSerializer, RouteLocationSerializer,
    BulkShipmentEventSerializer
)
from apps.shipments.models import Shipment
from apps.shipments.services import ShipmentStatusService
from apps.shipments.serializers import ShipmentSerializer
from apps.shipments.geocoding import geocode_address
import math

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
        
        # Automatically transition all 'Picked Up' shipments to 'In Transit'
        picked_up_shipments = Shipment.objects.filter(
            employee_id=user.employee_id,
            status='Picked Up'
        )
        for shipment in picked_up_shipments:
            ShipmentStatusService.update_status(
                shipment=shipment,
                new_status='In Transit',
                triggered_by=f"route-start-{session_id}"
            )
        
        logger.info(f'Route session started: {session_id} by {user.employee_id}. {picked_up_shipments.count()} shipments moved to In Transit.')
        
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
        
        session_id = request.data.get('id') or request.data.get('sessionId')
        if not session_id:
            return Response(
                {'success': False, 'message': 'Session ID required (id or sessionId)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use serializer for validation
        serializer = RouteSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Create or update session
        session, created = RouteSession.objects.get_or_create(
            id=session_id,
            defaults={
                'employee_id': user.employee_id,
                'start_latitude': serializer.validated_data['start_latitude'],
                'start_longitude': serializer.validated_data['start_longitude'],
                'shipment_id': serializer.validated_data.get('shipment_id'),
                'start_time': timezone.now(),
                'status': 'active'
            }
        )
        
        # Handle completion if provided
        is_completed = (request.data.get('status') == 'completed' or 
                        request.data.get('endTime') or 
                        request.data.get('end_time'))
        
        if is_completed:
            session.end_latitude = request.data.get('endLatitude') or request.data.get('end_latitude')
            session.end_longitude = request.data.get('endLongitude') or request.data.get('end_longitude')
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
        """Sync offline coordinates using batch submission logic"""
        # Re-use coordinates_batch logic but with sessionId support
        data = request.data
        if 'sessionId' in data:
            data['session_id'] = data.pop('sessionId')
        
        # Normalize batch input if needed
        # Actually coordinates_batch already uses CoordinateSerializer which we updated
        return self.coordinates_batch(request)
    
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
    
    @action(detail=False, methods=['post'])
    def optimize_path(self, request):
        """Optimize route path using Greedy TSP algorithm"""
        serializer = RouteOptimizeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        current_lat = serializer.validated_data['current_latitude']
        current_lng = serializer.validated_data['current_longitude']
        locations = serializer.validated_data['locations']
        
        if not locations:
            return Response({'success': True, 'ordered_locations': []})
            
        ordered_locations = []
        remaining_locations = list(locations)
        current_pos = (current_lat, current_lng)
        
        def calculate_distance(p1, p2):
            # Simple Haversine distance
            R = 6371  # Earth radius in km
            dlat = math.radians(p2[0] - p1[0])
            dlon = math.radians(p2[1] - p1[1])
            a = math.sin(dlat/2)**2 + math.cos(math.radians(p1[0])) * math.cos(math.radians(p2[0])) * math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            return R * c
            
        while remaining_locations:
            # Find nearest location
            nearest_idx = 0
            min_dist = float('inf')
            
            for i, loc in enumerate(remaining_locations):
                dist = calculate_distance(current_pos, (loc['latitude'], loc['longitude']))
                if dist < min_dist:
                    min_dist = dist
                    nearest_idx = i
                    
            next_loc = remaining_locations.pop(nearest_idx)
            ordered_locations.append(next_loc)
            current_pos = (next_loc['latitude'], next_loc['longitude'])
            
        return Response({
            'success': True,
            'ordered_locations': ordered_locations
        })
        
    @action(detail=False, methods=['get'])
    def shipments(self, request):
        """Get shipments assigned to the current rider session"""
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        # Filter shipments assigned to this employee that are not yet delivered/cancelled.
        # Include 'Picked Up' so drop points stay visible after rider marks pickups.
        shipments_qs = Shipment.objects.filter(
            employee_id=user.employee_id,
            status__in=['Assigned', 'In Transit', 'Initiated', 'Picked Up']
        ).order_by('created_at')
        
        # Geocode any shipment missing lat/long (e.g. customer delivery address when POPS didn't send coords)
        for shipment in shipments_qs:
            if (shipment.latitude is None or shipment.longitude is None) and shipment.address:
                try:
                    coords = geocode_address(shipment.address)
                    if coords:
                        shipment.latitude, shipment.longitude = coords
                        shipment.save(update_fields=['latitude', 'longitude'])
                except Exception as e:
                    logger.warning("Geocoding failed for shipment id=%s: %s", shipment.id, e)
        
        return Response({
            'success': True,
            'count': shipments_qs.count(),
            'shipments': ShipmentSerializer(shipments_qs, many=True).data
        })
        
    @action(detail=False, methods=['post'])
    def bulk_shipment_event(self, request):
        """Record event for multiple shipments at once"""
        serializer = BulkShipmentEventSerializer(data=request.data)
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
            
        event_type = serializer.validated_data['event_type']
        shipment_ids = serializer.validated_data['shipment_ids']
        lat = serializer.validated_data['latitude']
        lng = serializer.validated_data['longitude']
        
        from apps.shipments.models import Shipment
        results = []
        
        for s_id in shipment_ids:
            # Create tracking point for each shipment
            tracking = RouteTracking.objects.create(
                session=session,
                employee_id=user.employee_id,
                latitude=lat,
                longitude=lng,
                timestamp=timezone.now(),
                event_type=event_type,
                shipment_id=s_id
            )
            
            # Update shipment status
            try:
                shipment = Shipment.objects.get(id=s_id)
                if event_type == 'delivery':
                    shipment.status = 'Delivered'
                    shipment.actual_delivery_time = timezone.now()
                elif event_type == 'pickup':
                    shipment.status = 'Picked Up'
                shipment.save()
                results.append({'shipment_id': s_id, 'success': True})
            except Shipment.DoesNotExist:
                results.append({'shipment_id': s_id, 'success': False, 'message': 'Not found'})
                
        return Response({
            'success': True,
            'results': results,
            'message': f'Processed {len(results)} shipment events'
        })
