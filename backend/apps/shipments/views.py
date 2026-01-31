"""
Views for shipments app
"""
import logging
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Avg, Sum, F
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from .models import Shipment, Acknowledgment, RouteSession, RouteTracking
from .serializers import (
    ShipmentSerializer, ShipmentCreateSerializer, ShipmentUpdateSerializer,
    AcknowledgmentSerializer, DashboardMetricsSerializer,
    RouteSessionSerializer, RouteTrackingSerializer,
    RouteSessionCreateSerializer, RouteSessionStopSerializer,
    CoordinateSerializer, ShipmentEventSerializer
)
from .filters import ShipmentFilter
from utils.pops_client import pops_client

logger = logging.getLogger(__name__)


class ShipmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for shipments
    Supports CRUD operations and role-based filtering
    """
    queryset = Shipment.objects.all()
    serializer_class = ShipmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ShipmentFilter
    search_fields = ['customer_name', 'customer_mobile', 'address', 'route_name']
    ordering_fields = ['created_at', 'delivery_time', 'status']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter shipments based on user role"""
        queryset = super().get_queryset()
        user = self.request.user
        
        # Admins, managers, ops team see all shipments
        if user.is_superuser or user.is_ops_team or user.is_staff:
            return queryset
        
        # Drivers/riders see only their assigned shipments
        if user.employee_id:
            return queryset.filter(employee_id=user.employee_id)
        
        return queryset.none()
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return ShipmentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ShipmentUpdateSerializer
        return ShipmentSerializer
    
    def create(self, request, *args, **kwargs):
        """Create new shipment"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shipment = serializer.save()
        
        # If pops_order_id is provided, sync to POPS
        if shipment.pops_order_id and request.user.access_token:
            try:
                pops_client.update_order_status(
                    shipment.pops_order_id,
                    {'status': shipment.status},
                    request.user.access_token
                )
                shipment.synced_to_external = True
                shipment.sync_status = 'synced'
                shipment.save()
            except Exception as e:
                logger.error(f"Failed to sync shipment to POPS: {e}")
        
        return Response(
            ShipmentSerializer(shipment).data,
            status=status.HTTP_201_CREATED
        )
    
    def update(self, request, *args, **kwargs):
        """Update shipment"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Reset sync status when updating
        shipment = serializer.save()
        shipment.synced_to_external = False
        shipment.sync_status = 'pending'
        shipment.sync_attempts = 0
        shipment.save()
        
        # Sync to POPS if pops_order_id exists
        if shipment.pops_order_id and request.user.access_token:
            try:
                pops_client.update_order_status(
                    shipment.pops_order_id,
                    {'status': shipment.status},
                    request.user.access_token
                )
                shipment.synced_to_external = True
                shipment.sync_status = 'synced'
                shipment.save()
            except Exception as e:
                logger.error(f"Failed to sync shipment update to POPS: {e}")
        
        return Response(ShipmentSerializer(shipment).data)
    
    @action(detail=True, methods=['post'])
    def remarks(self, request, pk=None):
        """Add remarks to shipment"""
        shipment = self.get_object()
        status_value = request.data.get('status')
        remarks = request.data.get('remarks')
        
        if not status_value or not remarks:
            return Response(
                {'success': False, 'message': 'Status and remarks are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate status based on shipment type
        if status_value == 'Delivered' and shipment.type != 'delivery':
            return Response(
                {'message': 'Cannot mark a pickup shipment as Delivered'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if status_value == 'Picked Up' and shipment.type != 'pickup':
            return Response(
                {'message': 'Cannot mark a delivery shipment as Picked Up'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        shipment.status = status_value
        shipment.remarks = remarks
        shipment.synced_to_external = False
        shipment.sync_status = 'pending'
        shipment.save()
        
        # Sync to POPS
        if shipment.pops_order_id and request.user.access_token:
            try:
                pops_client.update_order_status(
                    shipment.pops_order_id,
                    {'status': status_value, 'remarks': remarks},
                    request.user.access_token
                )
                shipment.synced_to_external = True
                shipment.sync_status = 'synced'
                shipment.save()
            except Exception as e:
                logger.error(f"Failed to sync remarks to POPS: {e}")
        
        return Response({
            'success': True,
            'message': 'Remarks saved successfully',
            'shipment': ShipmentSerializer(shipment).data
        })
    
    @action(detail=True, methods=['patch'])
    def tracking(self, request, pk=None):
        """Update shipment tracking data - matches /api/shipments/:id/tracking"""
        shipment = self.get_object()
        
        # Allowed tracking fields
        allowed_fields = {
            'start_latitude': 'start_latitude',
            'start_longitude': 'start_longitude',
            'stop_latitude': 'stop_latitude',
            'stop_longitude': 'stop_longitude',
            'km_travelled': 'km_travelled',
            'status': 'status',
            'actualDeliveryTime': 'actual_delivery_time'
        }
        
        updates = {}
        for field, db_field in allowed_fields.items():
            if field in request.data:
                if field == 'actualDeliveryTime':
                    from django.utils.dateparse import parse_datetime
                    value = request.data[field]
                    if isinstance(value, str):
                        updates[db_field] = parse_datetime(value) or timezone.now()
                    else:
                        updates[db_field] = value
                else:
                    updates[db_field] = request.data[field]
        
        if not updates:
            return Response(
                {'success': False, 'message': 'No valid tracking fields provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update shipment
        for key, value in updates.items():
            setattr(shipment, key, value)
        
        shipment.synced_to_external = False
        shipment.sync_status = 'pending'
        shipment.save()
        
        return Response({
            'success': True,
            'message': 'Tracking data updated successfully',
            'shipment': ShipmentSerializer(shipment).data
        })
    
    def destroy(self, request, *args, **kwargs):
        """Delete shipment - matches DELETE /api/shipments/:id"""
        shipment = self.get_object()
        
        # For now, mark as deleted rather than actually deleting
        shipment.status = 'Deleted'
        shipment.save()
        
        return Response({
            'message': 'Shipment deleted successfully',
            'shipmentId': shipment.id
        })
    
    @action(detail=True, methods=['post'])
    def acknowledgement(self, request, pk=None):
        """Upload acknowledgment (signature and photo)"""
        shipment = self.get_object()
        signature_url = request.data.get('signature_url') or request.data.get('signatureData')
        photo_url = request.data.get('photo_url')
        
        # Handle file uploads if provided
        if 'signature' in request.FILES:
            # Save signature file
            signature_file = request.FILES['signature']
            # TODO: Implement file upload handling
            signature_url = f"/media/signatures/{signature_file.name}"
        
        if 'photo' in request.FILES:
            # Save photo file
            photo_file = request.FILES['photo']
            # TODO: Implement file upload handling
            photo_url = f"/media/photos/{photo_file.name}"
        
        # Create or update acknowledgment
        acknowledgment, created = Acknowledgment.objects.get_or_create(
            shipment=shipment,
            defaults={
                'signature_url': signature_url,
                'photo_url': photo_url,
                'acknowledgment_captured_by': request.user.employee_id or str(request.user.id)
            }
        )
        
        if not created:
            acknowledgment.signature_url = signature_url or acknowledgment.signature_url
            acknowledgment.photo_url = photo_url or acknowledgment.photo_url
            acknowledgment.acknowledgment_captured_by = request.user.employee_id or str(request.user.id)
            acknowledgment.save()
        
        # Update shipment
        shipment.signature_url = acknowledgment.signature_url
        shipment.photo_url = acknowledgment.photo_url
        shipment.acknowledgment_captured_at = acknowledgment.acknowledgment_captured_at
        shipment.acknowledgment_captured_by = acknowledgment.acknowledgment_captured_by
        shipment.save()
        
        # Sync to POPS
        if shipment.pops_order_id and request.user.access_token:
            try:
                pops_client.update_order_status(
                    shipment.pops_order_id,
                    {
                        'status': shipment.status,
                        'acknowledgment': {
                            'signature_url': acknowledgment.signature_url,
                            'photo_url': acknowledgment.photo_url,
                            'acknowledgment_captured_at': acknowledgment.acknowledgment_captured_at.isoformat()
                        }
                    },
                    request.user.access_token
                )
                shipment.synced_to_external = True
                shipment.sync_status = 'synced'
                shipment.save()
            except Exception as e:
                logger.error(f"Failed to sync acknowledgment to POPS: {e}")
        
        return Response({
            'success': True,
            'message': 'Acknowledgment saved successfully',
            'acknowledgment': AcknowledgmentSerializer(acknowledgment).data
        })
    
    @action(detail=False, methods=['patch'])
    def batch(self, request):
        """Batch update shipments"""
        updates = request.data.get('updates', [])
        if not updates:
            return Response(
                {'error': 'Updates array is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updated_count = 0
        for update_data in updates:
            shipment_id = update_data.get('id')
            if not shipment_id:
                continue
            
            try:
                shipment = Shipment.objects.get(id=shipment_id)
                serializer = ShipmentUpdateSerializer(shipment, data=update_data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    shipment.synced_to_external = False
                    shipment.sync_status = 'pending'
                    shipment.save()
                    updated_count += 1
            except Shipment.objects.model.DoesNotExist:
                continue
        
        return Response({
            'success': True,
            'updated': updated_count
        })
    
    @action(detail=False, methods=['get'])
    def fetch(self, request):
        """Fetch shipments with filters and pagination (matches Node.js endpoint)"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        limit = min(100, max(1, limit))
        
        start = (page - 1) * limit
        end = start + limit
        
        total = queryset.count()
        shipments = queryset[start:end]
        
        serializer = self.get_serializer(shipments, many=True)
        
        response = Response(serializer.data)
        response['X-Total-Count'] = total
        response['X-Total-Pages'] = (total + limit - 1) // limit
        response['X-Current-Page'] = page
        response['X-Per-Page'] = limit
        response['X-Has-Next-Page'] = str(page < (total + limit - 1) // limit).lower()
        response['X-Has-Previous-Page'] = str(page > 1).lower()
        
        return response


class DashboardViewSet(viewsets.ViewSet):
    """Dashboard metrics viewset"""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """Get dashboard metrics"""
        user = request.user
        queryset = Shipment.objects.all()
        
        # Filter by employee if not admin/manager
        if not (user.is_superuser or user.is_ops_team or user.is_staff):
            queryset = queryset.filter(employee_id=user.employee_id)
        
        total = queryset.count()
        pending = queryset.filter(status='Assigned').count()
        in_transit = queryset.filter(status='In Transit').count()
        delivered = queryset.filter(status='Delivered').count()
        picked_up = queryset.filter(status='Picked Up').count()
        returned = queryset.filter(status='Returned').count()
        cancelled = queryset.filter(status='Cancelled').count()
        
        # Calculate revenue (sum of costs for delivered/picked up)
        completed = queryset.filter(status__in=['Delivered', 'Picked Up'])
        total_revenue = completed.aggregate(total=Sum('cost'))['total'] or 0
        
        # Calculate average delivery time
        completed_with_time = completed.exclude(actual_delivery_time__isnull=True)
        if completed_with_time.exists():
            avg_time = completed_with_time.aggregate(
                avg=Avg(
                    F('actual_delivery_time') - F('delivery_time')
                )
            )['avg']
            avg_delivery_time = avg_time.total_seconds() / 3600 if avg_time else 0
        else:
            avg_delivery_time = 0
        
        metrics = {
            'total_shipments': total,
            'pending_shipments': pending,
            'in_transit_shipments': in_transit,
            'delivered_shipments': delivered,
            'picked_up_shipments': picked_up,
            'returned_shipments': returned,
            'cancelled_shipments': cancelled,
            'total_revenue': total_revenue,
            'average_delivery_time': avg_delivery_time
        }
        
        serializer = DashboardMetricsSerializer(metrics)
        return Response(serializer.data)


# Route tracking views (consolidated from routes app)
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
            import math
            total_distance = 0
            prev_point = None
            for point in tracking_points.order_by('timestamp'):
                if prev_point:
                    lat1, lon1 = prev_point.latitude, prev_point.longitude
                    lat2, lon2 = point.latitude, point.longitude
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
        from .services import location_tracking
        
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
        from .services import location_tracking
        
        user = request.user
        if not user.employee_id:
            return Response(
                {'success': False, 'message': 'Unauthorized'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
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
        from .services import location_tracking
        
        user = request.user
        if not (user.is_superuser or user.is_ops_team or user.is_staff):
            return Response(
                {'success': False, 'message': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        locations = location_tracking.get_active_riders_locations()
        
        return Response({
            'success': True,
            'riders': locations,
            'count': len(locations)
        })
    
    @action(detail=False, methods=['get'], url_path='active/(?P<employee_id>[^/.]+)')
    def active_session(self, request, employee_id=None):
        """Get active session for an employee"""
        user = request.user
        
        # Check access
        if not (user.is_superuser or user.is_ops_team or user.is_staff):
            if user.employee_id != employee_id:
                return Response(
                    {'success': False, 'message': 'Access denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        try:
            session = RouteSession.objects.filter(
                employee_id=employee_id,
                status='active'
            ).latest('start_time')
            
            return Response({
                'success': True,
                'session': RouteSessionSerializer(session).data
            })
        except RouteSession.DoesNotExist:
            return Response({
                'success': True,
                'session': None,
                'message': 'No active session found'
            })
    
    @action(detail=True, methods=['get'], url_path='summary')
    def session_summary(self, request, pk=None):
        """Get session summary with calculated metrics"""
        try:
            session = RouteSession.objects.get(id=pk)
            user = request.user
            
            if not (user.is_superuser or user.is_ops_team or user.is_staff):
                if session.employee_id != user.employee_id:
                    return Response(
                        {'success': False, 'message': 'Access denied'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            # Get tracking points
            tracking_points = RouteTracking.objects.filter(session=session).order_by('timestamp')
            
            # Calculate summary metrics
            total_points = tracking_points.count()
            total_distance = session.total_distance or 0
            total_time = session.total_time or 0
            average_speed = session.average_speed or 0
            fuel_consumed = session.fuel_consumed or 0
            fuel_cost = session.fuel_cost or 0
            shipments_completed = session.shipments_completed or 0
            
            # Calculate efficiency
            efficiency = 0
            if shipments_completed > 0:
                efficiency = total_distance / shipments_completed
            
            summary = {
                'sessionId': session.id,
                'employeeId': session.employee_id,
                'startTime': session.start_time.isoformat() if session.start_time else None,
                'endTime': session.end_time.isoformat() if session.end_time else None,
                'status': session.status,
                'totalPoints': total_points,
                'totalDistance': float(total_distance),
                'totalTime': int(total_time),
                'averageSpeed': float(average_speed),
                'fuelConsumed': float(fuel_consumed),
                'fuelCost': float(fuel_cost),
                'shipmentsCompleted': int(shipments_completed),
                'efficiency': efficiency,
                'startLatitude': session.start_latitude,
                'startLongitude': session.start_longitude,
                'endLatitude': session.end_latitude,
                'endLongitude': session.end_longitude
            }
            
            return Response({
                'success': True,
                'summary': summary
            })
        except RouteSession.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Session not found'},
                status=status.HTTP_404_NOT_FOUND
            )


# Sync views (consolidated from sync app)
class SyncViewSet(viewsets.ViewSet):
    """ViewSet for sync operations"""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get sync statistics"""
        pending = Shipment.objects.filter(sync_status='pending').count()
        failed = Shipment.objects.filter(sync_status='failed').count()
        synced = Shipment.objects.filter(sync_status='synced').count()
        
        return Response({
            'totalSynced': synced,
            'pendingSync': pending,
            'failedSync': failed,
            'lastSyncTime': None  # TODO: Track last sync time
        })
    
    @action(detail=False, methods=['post'])
    def trigger(self, request):
        """Trigger manual sync"""
        pending_shipments = Shipment.objects.filter(
            sync_status__in=['pending', 'needs_sync']
        )[:1000]
        
        if not pending_shipments.exists():
            return Response({
                'success': True,
                'message': 'No pending shipments to sync'
            })
        
        success_count = 0
        failed_count = 0
        
        for shipment in pending_shipments:
            if shipment.pops_order_id and request.user.access_token:
                try:
                    pops_client.update_order_status(
                        shipment.pops_order_id,
                        {'status': shipment.status},
                        request.user.access_token
                    )
                    shipment.synced_to_external = True
                    shipment.sync_status = 'synced'
                    shipment.sync_attempts = 0
                    shipment.save()
                    success_count += 1
                except Exception as e:
                    logger.error(f"Failed to sync shipment {shipment.id}: {e}")
                    shipment.sync_status = 'failed'
                    shipment.sync_attempts += 1
                    shipment.sync_error = str(e)
                    shipment.save()
                    failed_count += 1
        
        return Response({
            'success': True,
            'message': f'Sync completed: {success_count} successful, {failed_count} failed',
            'details': {
                'success': success_count,
                'failed': failed_count
            }
        })
    
    @action(detail=False, methods=['get'])
    def sync_status(self, request):
        """Get sync status for shipments"""
        shipment_id = request.query_params.get('shipmentId')
        status_filter = request.query_params.get('status')
        
        if shipment_id:
            try:
                shipment = Shipment.objects.get(id=shipment_id)
                return Response({
                    'success': True,
                    'syncStatuses': [{
                        'shipmentId': shipment.id,
                        'status': shipment.sync_status,
                        'lastSyncAt': shipment.last_sync_attempt,
                        'syncAttempts': shipment.sync_attempts,
                        'lastError': shipment.sync_error
                    }]
                })
            except Shipment.DoesNotExist:
                return Response(
                    {'success': False, 'message': 'Shipment not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        return Response({
            'success': True,
            'syncStatuses': []
        })
    
    @action(detail=False, methods=['post'], url_path='shipments/(?P<shipment_id>[^/.]+)/sync')
    def sync_shipment(self, request, shipment_id=None):
        """Sync single shipment"""
        try:
            shipment = Shipment.objects.get(id=shipment_id)
        except Shipment.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Shipment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if shipment.pops_order_id and request.user.access_token:
            try:
                pops_client.update_order_status(
                    shipment.pops_order_id,
                    {'status': shipment.status},
                    request.user.access_token
                )
                shipment.synced_to_external = True
                shipment.sync_status = 'synced'
                shipment.save()
                return Response({
                    'success': True,
                    'message': 'Shipment synced successfully',
                    'shipmentId': shipment_id
                })
            except Exception as e:
                logger.error(f"Failed to sync shipment {shipment_id}: {e}")
                return Response(
                    {'success': False, 'message': f'Failed to sync: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        return Response({
            'success': False,
            'message': 'Shipment cannot be synced (missing pops_order_id or access token)'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def batch_sync(self, request):
        """Batch sync multiple shipments"""
        shipment_ids = request.data.get('shipmentIds', [])
        
        if not isinstance(shipment_ids, list) or len(shipment_ids) == 0:
            return Response(
                {'success': False, 'message': 'shipmentIds must be a non-empty array'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        processed = 0
        for shipment_id in shipment_ids:
            try:
                shipment = Shipment.objects.get(id=shipment_id)
                if shipment.pops_order_id and request.user.access_token:
                    pops_client.update_order_status(
                        shipment.pops_order_id,
                        {'status': shipment.status},
                        request.user.access_token
                    )
                    shipment.synced_to_external = True
                    shipment.sync_status = 'synced'
                    shipment.save()
                    processed += 1
            except Exception as e:
                logger.error(f"Failed to sync shipment {shipment_id}: {e}")
        
        return Response({
            'success': True,
            'message': f'Batch sync completed for {processed} shipments',
            'processed': processed
        })
