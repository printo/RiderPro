"""
Views for shipments app
"""
import logging
import math
from collections import defaultdict
from rest_framework import viewsets, status, filters
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Avg, Sum, F
from django.utils import timezone
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from .models import Shipment, Acknowledgment, RouteSession, RouteTracking, AcknowledgmentSettings
from .serializers import (
    ShipmentSerializer, ShipmentCreateSerializer, ShipmentUpdateSerializer,
    AcknowledgmentSerializer, DashboardMetricsSerializer,
    RouteSessionSerializer, RouteTrackingSerializer,
    RouteSessionCreateSerializer, RouteSessionStopSerializer,
    CoordinateSerializer, ShipmentEventSerializer,
    RouteOptimizeRequestSerializer, BulkShipmentEventSerializer,
    ChangeRiderSerializer, BatchChangeRiderSerializer, AcknowledgmentSettingsSerializer
)
from .filters import ShipmentFilter
from utils.pops_client import pops_client

logger = logging.getLogger(__name__)

ACK_REQUIRED_STATUS_VALUES = {'Delivered', 'Picked Up'}
ACK_REQUIRED_EVENT_TYPES = {'delivery', 'pickup'}
DELIVERY_ACK_REQUIRED_MESSAGE = (
    "Recipient signature and current shipment photo are required before marking as Delivered or Picked Up."
)
SKIPPED_REASON_REQUIRED_MESSAGE = "Reason is required when marking a shipment as Skipped."


def _is_manager_user(user):
    return (
        user.is_superuser
        or user.is_staff
        or user.is_ops_team
        or getattr(user, 'role', None) in ['admin', 'manager']
    )


from django.conf import settings

def _has_required_acknowledgment(shipment):
    # 🚀 TEST MODE BYPASS
    if getattr(settings, "TEST_MODE", False):
        return True

    signature_url = shipment.signature_url
    photo_url = shipment.photo_url

    if signature_url or photo_url:
        return True

    try:
        acknowledgment = shipment.acknowledgment
    except Acknowledgment.DoesNotExist:
        acknowledgment = None

    if acknowledgment:
        signature_url = signature_url or acknowledgment.signature_url
        photo_url = photo_url or acknowledgment.photo_url

    return bool(signature_url or photo_url)


class ShipmentViewSet(viewsets.ModelViewSet):
    parser_classes = (MultiPartParser, FormParser)
    @action(detail=True, methods=['post'])
    def toggle_collected_status(self, request, pk=None):
        """
        Toggle collected status of a shipment between 'Assigned' and 'Collected'
        """
        shipment = self.get_object()
        user = request.user
        
        # Check if user has permission to update this shipment
        if not (user.is_superuser or user.is_staff or 
                user.employee_id == shipment.employee_id or
                getattr(user, 'role', None) in ['admin', 'manager'] or
                getattr(user, 'is_ops_team', False)):
            return Response(
                {'success': False, 'message': 'Not authorized to update this shipment'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from .services import ShipmentStatusService
        
        if shipment.status == 'Assigned':
            # Mark as Collected
            new_status = 'Collected'
            success_message = 'Shipment marked as Collected'
        elif shipment.status == 'Collected':
            # Unmark back to Assigned
            new_status = 'Assigned'
            success_message = 'Shipment unmarked from Collected status'
        else:
            return Response(
                {'success': False, 'message': 'Only Assigned or Collected shipments can be toggled'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update status
        ShipmentStatusService.update_status(
            shipment=shipment,
            new_status=new_status,
            triggered_by=user.username or str(user.id),
            metadata={
                'action': 'toggled_collected_status',
                'previous_status': shipment.status
            }
        )
        
        from .serializers import ShipmentSerializer
        return Response({
            'success': True,
            'message': success_message,
            'shipment': ShipmentSerializer(shipment).data
        })
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
        employee_id = self._resolve_user_employee_id(user)
        if employee_id:
            return queryset.filter(employee_id=employee_id)
        
        return queryset.none()
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return ShipmentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ShipmentUpdateSerializer
        return ShipmentSerializer

    @staticmethod
    def _resolve_user_employee_id(user):
        """
        Resolve employee identifier from authenticated user.
        Custom User model does not always expose `employee_id`, so fall back to username.
        """
        return (
            getattr(user, 'employee_id', None)
            or getattr(user, 'username', None)
            or str(getattr(user, 'id', ''))
        )

    @staticmethod
    def _resolve_pops_token(request):
        """
        Prefer service token for server-to-server sync, fall back to user token.
        """
        return getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None) or getattr(request.user, 'access_token', None)

    def _sync_shipment_to_pops(self, shipment, request):
        """
        Sync shipment updates to POPS for rider/status/route/remarks/ack artifacts.
        """
        if not shipment.pops_order_id:
            return False

        access_token = self._resolve_pops_token(request)
        if not access_token:
            logger.warning("POPS sync skipped: missing access token for shipment %s", shipment.id)
            shipment.sync_status = 'failed'
            shipment.sync_error = 'Missing POPS access token'
            shipment.sync_attempts += 1
            shipment.last_sync_attempt = timezone.now()
            shipment.save(update_fields=['sync_status', 'sync_error', 'sync_attempts', 'last_sync_attempt', 'updated_at'])
            return False

        # Map RiderPro fields to POPS Order fields.
        payload = {}
        if shipment.status is not None:
            payload['status'] = shipment.status
        if shipment.employee_id:
            payload['assigned_to'] = shipment.employee_id
        if shipment.route_name:
            payload['route'] = shipment.route_name
        if shipment.remarks:
            payload['remarks'] = shipment.remarks

        if shipment.photo_url:
            payload['acknowledgement_url'] = shipment.photo_url
        if shipment.signed_pdf_url:
            payload['acknowledgement_submission_file'] = shipment.signed_pdf_url
        ack_artifacts = {}
        if shipment.signature_url:
            ack_artifacts['signature_url'] = shipment.signature_url
        if shipment.photo_url:
            ack_artifacts['photo_url'] = shipment.photo_url
        if shipment.signed_pdf_url:
            ack_artifacts['signed_pdf_url'] = shipment.signed_pdf_url
        if ack_artifacts:
            payload['callback_response'] = {
                'source': 'riderpro',
                'riderpro_acknowledgment': ack_artifacts,
            }

        if not payload:
            return False

        try:
            result = pops_client.update_order_fields(shipment.pops_order_id, payload, access_token)
            if result is None:
                raise ValueError("POPS sync returned empty response")

            shipment.synced_to_external = True
            shipment.sync_status = 'synced'
            shipment.sync_error = ''
            shipment.sync_attempts = 0
            shipment.last_sync_attempt = timezone.now()
            shipment.save(update_fields=[
                'synced_to_external', 'sync_status', 'sync_error',
                'sync_attempts', 'last_sync_attempt', 'updated_at'
            ])
            return True
        except Exception as exc:
            logger.error("Failed POPS sync for shipment %s: %s", shipment.id, exc, exc_info=True)
            shipment.synced_to_external = False
            shipment.sync_status = 'failed'
            shipment.sync_error = str(exc)
            shipment.sync_attempts += 1
            shipment.last_sync_attempt = timezone.now()
            shipment.save(update_fields=[
                'synced_to_external', 'sync_status', 'sync_error',
                'sync_attempts', 'last_sync_attempt', 'updated_at'
            ])
            return False
    
    def create(self, request, *args, **kwargs):
        """Create new shipment"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shipment = serializer.save()
        
        # Sync to POPS when order mapping is available
        self._sync_shipment_to_pops(shipment, request)
        
        return Response(
            ShipmentSerializer(shipment).data,
            status=status.HTTP_201_CREATED
        )
    
    def update(self, request, *args, **kwargs):
        """
        Update shipment
        Managers can update: route_name, special_instructions, remarks, employee_id
        Riders can update: status (with restrictions)
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Check if user is manager/admin for certain fields
        is_manager = _is_manager_user(request.user)
        
        # If updating route_name, special_instructions, or employee_id, require manager permissions
        if not is_manager:
            restricted_fields = ['route_name', 'special_instructions', 'employee_id']
            if any(field in request.data for field in restricted_fields):
                return Response(
                    {'success': False, 'message': 'Only managers can update route, special instructions, or rider assignment'},
                    status=status.HTTP_403_FORBIDDEN
                )

        requested_status = request.data.get('status')
        requested_remarks = request.data.get('remarks')
        if requested_status == 'Picked Up' and instance.type != 'pickup':
            return Response(
                {'success': False, 'message': 'Cannot mark a delivery shipment as Picked Up'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if requested_status == 'Collected' and instance.type == 'pickup':
            return Response(
                {'success': False, 'message': 'Use Picked Up for pickup/store-pickup shipments; Collected is for rider collection flow.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if (
            requested_status in ACK_REQUIRED_STATUS_VALUES
            and not is_manager
            and not _has_required_acknowledgment(instance)
        ):
            return Response(
                {'success': False, 'message': DELIVERY_ACK_REQUIRED_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST
            )
        if requested_status == 'Skipped' and not str(requested_remarks or '').strip():
            return Response(
                {'success': False, 'message': SKIPPED_REASON_REQUIRED_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        old_employee_id = instance.employee_id
        
        # Reset sync status when updating
        shipment = serializer.save()
        shipment.synced_to_external = False
        shipment.sync_status = 'pending'
        shipment.sync_attempts = 0
        shipment.save()
        
        # If employee_id changed, create assignment event
        if 'employee_id' in request.data and request.data['employee_id'] != old_employee_id:
            from .services import ShipmentStatusService
            ShipmentStatusService.create_event(
                shipment=shipment,
                event_type='assignment',
                metadata={
                    'old_employee_id': old_employee_id,
                    'new_employee_id': request.data['employee_id'],
                    'changed_by': request.user.username or str(request.user.id)
                },
                triggered_by=f"{request.user.username or request.user.id}"
            )
        
        # Sync full mutable payload to POPS (status/rider/route/remarks/ack artifacts)
        self._sync_shipment_to_pops(shipment, request)
        
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
        if status_value == 'Collected' and shipment.type == 'pickup':
            return Response(
                {'message': 'Use Picked Up for pickup/store-pickup shipments; Collected is for rider collection flow.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if (
            status_value in ACK_REQUIRED_STATUS_VALUES
            and not _is_manager_user(request.user)
            and not _has_required_acknowledgment(shipment)
        ):
            return Response(
                {'success': False, 'message': DELIVERY_ACK_REQUIRED_MESSAGE},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use centralized status service
        from .services import ShipmentStatusService
        triggered_by = f"{request.user.username or request.user.id}"
        shipment, event = ShipmentStatusService.update_status(
            shipment=shipment,
            new_status=status_value,
            triggered_by=triggered_by,
            metadata={'remarks': remarks},
            sync_to_pops=False
        )
        shipment.remarks = remarks
        shipment.save()
        self._sync_shipment_to_pops(shipment, request)
        
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
        """
        Upload acknowledgment (signature and photo)
        Validates against region-based acknowledgment settings
        """
        shipment = self.get_object()
        
        # Handle FormData vs JSON properly
        if request.content_type and 'multipart/form-data' in request.content_type:
            # FormData handling
            signature_url = request.POST.get('signature_url')
            photo_url = request.POST.get('photo_url')
            signed_pdf_url = request.POST.get('signed_pdf_url')
        else:
            # JSON handling
            signature_url = (
                request.data.get('signature_url')
                or request.data.get('signatureData')
                or request.data.get('signature')
            )
            photo_url = request.data.get('photo_url')
            signed_pdf_url = request.data.get('signed_pdf_url')
        
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
        
        # Validate against acknowledgment settings
        region = shipment.region
        if not region and shipment.address and isinstance(shipment.address, dict):
            region = shipment.address.get('city') or shipment.address.get('state')
        
        if region:
            try:
                ack_settings = AcknowledgmentSettings.objects.get(region=region, is_active=True)
                has_signature = bool(signature_url)
                has_photo = bool(photo_url)
                
                is_valid, error_message = ack_settings.validate_acknowledgment(has_signature, has_photo)
                
                if not is_valid and not ack_settings.allow_skip_acknowledgment:
                    return Response(
                        {'success': False, 'message': error_message},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except AcknowledgmentSettings.DoesNotExist:
                pass  # No settings for this region, allow any acknowledgment
        
        # Create or update acknowledgment
        captured_by = self._resolve_user_employee_id(request.user)
        acknowledgment, created = Acknowledgment.objects.get_or_create(
            shipment=shipment,
            defaults={
                'signature_url': signature_url,
                'photo_url': photo_url,
                'acknowledgment_captured_by': captured_by
            }
        )
        
        if not created:
            acknowledgment.signature_url = signature_url or acknowledgment.signature_url
            acknowledgment.photo_url = photo_url or acknowledgment.photo_url
            acknowledgment.acknowledgment_captured_by = captured_by
            acknowledgment.save()
        
        # Update shipment
        shipment.signature_url = acknowledgment.signature_url
        shipment.photo_url = acknowledgment.photo_url
        if signed_pdf_url:
            shipment.signed_pdf_url = signed_pdf_url
        shipment.acknowledgment_captured_at = acknowledgment.acknowledgment_captured_at
        shipment.acknowledgment_captured_by = acknowledgment.acknowledgment_captured_by
        shipment.save()
        
        # Sync to POPS
        self._sync_shipment_to_pops(shipment, request)
        
        return Response({
            'success': True,
            'message': 'Acknowledgment saved successfully',
            'acknowledgment': AcknowledgmentSerializer(acknowledgment).data
        })
    
    @action(detail=True, methods=['post'], url_path='change-rider')
    def change_rider(self, request, pk=None):
        """
        Change the rider assigned to a shipment (Manager only)
        
        Validations:
        - Only managers/admins can change riders
        - Cannot change if shipment is already in progress (In Transit, Picked Up, Delivered, Returned, Cancelled)
        - New rider must exist and be approved
        """
        shipment = self.get_object()
        
        # Check permissions - only managers/admins
        if not (request.user.is_superuser or request.user.is_staff or 
                request.user.role in ['admin', 'manager'] or request.user.is_ops_team):
            return Response(
                {'success': False, 'message': 'Only managers and admins can change riders'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ChangeRiderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        new_employee_id = serializer.validated_data['employee_id']
        reason = serializer.validated_data.get('reason', '')
        
        # Validation: Cannot change rider if shipment is already in progress
        blocked_statuses = ['Collected', 'In Transit', 'Picked Up', 'Delivered', 'Skipped', 'Returned', 'Cancelled']
        if shipment.status in blocked_statuses:
            return Response(
                {
                    'success': False,
                    'message': f'Cannot change rider. Shipment is already {shipment.status}. '
                              f'Rider can only be changed when status is Initiated or Assigned.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation: Check if new rider exists and is approved
        try:
            from apps.authentication.models import RiderAccount
            RiderAccount.objects.get(
                rider_id=new_employee_id,
                is_active=True,
                is_approved=True
            )
        except RiderAccount.DoesNotExist:
            return Response(
                {
                    'success': False,
                    'message': f'Rider with ID "{new_employee_id}" not found or not approved in Rider Accounts.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Store old rider for event logging
        old_employee_id = shipment.employee_id
        
        # Update shipment
        shipment.employee_id = new_employee_id
        shipment.synced_to_external = False
        shipment.sync_status = 'needs_sync'
        shipment.save()
        self._sync_shipment_to_pops(shipment, request)
        
        # Create assignment event
        from .services import ShipmentStatusService
        ShipmentStatusService.create_event(
            shipment=shipment,
            event_type='assignment',
            metadata={
                'old_employee_id': old_employee_id,
                'new_employee_id': new_employee_id,
                'reason': reason,
                'changed_by': request.user.username or str(request.user.id)
            },
            triggered_by=f"{request.user.username or request.user.id}"
        )
        
        logger.info(
            f"Rider changed for shipment {shipment.id}: {old_employee_id} -> {new_employee_id} "
            f"(by {request.user.username or request.user.id})"
        )
        
        return Response({
            'success': True,
            'message': f'Rider changed from {old_employee_id} to {new_employee_id}',
            'shipment': ShipmentSerializer(shipment).data
        })
    
    @action(detail=False, methods=['get'], url_path='available-riders')
    def available_riders(self, request):
        """
        Get list of available riders for assignment
        Returns active and approved riders from RiderAccount table only
        """
        try:
            from apps.authentication.models import RiderAccount
            
            # Get approved riders from RiderAccount table only
            riders = RiderAccount.objects.filter(
                is_active=True,
                is_approved=True
            ).values('rider_id', 'full_name', 'email').order_by('rider_id')
            
            rider_list = [
                {
                    'id': r['rider_id'],
                    'name': r.get('full_name') or r['rider_id'],
                    'email': r.get('email', '')
                }
                for r in riders
            ]
            
            return Response({
                'success': True,
                'riders': rider_list,
                'count': len(rider_list)
            })
            
        except Exception as e:
            logger.error(f"Error fetching available riders: {e}", exc_info=True)
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='available-routes')
    def available_routes(self, request):
        """
        Get list of distinct route names from shipments
        """
        try:
            routes = Shipment.objects.exclude(
                route_name__isnull=True
            ).exclude(
                route_name=''
            ).values_list('route_name', flat=True).distinct().order_by('route_name')
            
            route_list = [{'name': route, 'value': route} for route in routes if route]
            
            return Response({
                'success': True,
                'routes': route_list,
                'count': len(route_list)
            })
            
        except Exception as e:
            logger.error(f"Error fetching available routes: {e}", exc_info=True)
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='batch-change-rider')
    def batch_change_rider(self, request):
        """
        Batch change rider for multiple shipments
        Only managers and admins can perform this action
        """
        # Check permissions
        is_manager = (request.user.is_superuser or request.user.is_staff or 
                     request.user.role in ['admin', 'manager'] or request.user.is_ops_team)
        
        if not is_manager:
            return Response(
                {'success': False, 'message': 'Only managers and admins can batch change riders'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = BatchChangeRiderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        shipment_ids = serializer.validated_data['shipment_ids']
        new_employee_id = serializer.validated_data['employee_id']
        reason = serializer.validated_data.get('reason', '')
        
        # Validation: Check if new rider exists in RiderAccount
        try:
            from apps.authentication.models import RiderAccount
            RiderAccount.objects.get(
                rider_id=new_employee_id,
                is_active=True,
                is_approved=True
            )
        except RiderAccount.DoesNotExist:
            return Response(
                {
                    'success': False,
                    'message': f'Rider with ID "{new_employee_id}" not found or not approved in Rider Accounts.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get shipments
        shipments = Shipment.objects.filter(id__in=shipment_ids)
        
        if not shipments.exists():
            return Response(
                {'success': False, 'message': 'No shipments found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validation: Cannot change rider if shipment is already in progress
        blocked_statuses = ['Collected', 'In Transit', 'Picked Up', 'Delivered', 'Skipped', 'Returned', 'Cancelled']
        blocked_shipments = shipments.filter(status__in=blocked_statuses)
        
        if blocked_shipments.exists():
            blocked_ids = list(blocked_shipments.values_list('id', flat=True))
            return Response(
                {
                    'success': False,
                    'message': f'Cannot change rider for {len(blocked_shipments)} shipment(s). '
                              f'They are already in progress. Shipment IDs: {blocked_ids}',
                    'blocked_shipment_ids': blocked_ids
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update shipments
        updated_count = 0
        failed_count = 0
        results = []
        
        for shipment in shipments:
            try:
                old_employee_id = shipment.employee_id
                
                # Update shipment
                shipment.employee_id = new_employee_id
                shipment.synced_to_external = False
                shipment.sync_status = 'needs_sync'
                shipment.save()
                self._sync_shipment_to_pops(shipment, request)
                
                # Create assignment event
                from .services import ShipmentStatusService
                ShipmentStatusService.create_event(
                    shipment=shipment,
                    event_type='assignment',
                    metadata={
                        'old_employee_id': old_employee_id,
                        'new_employee_id': new_employee_id,
                        'reason': reason,
                        'changed_by': request.user.username or str(request.user.id),
                        'batch_update': True
                    },
                    triggered_by=f"{request.user.username or request.user.id}"
                )
                
                updated_count += 1
                results.append({
                    'shipment_id': shipment.id,
                    'success': True,
                    'old_rider': old_employee_id,
                    'new_rider': new_employee_id
                })
                
            except Exception as e:
                failed_count += 1
                results.append({
                    'shipment_id': shipment.id,
                    'success': False,
                    'error': str(e)
                })
                logger.error(f"Failed to update shipment {shipment.id}: {e}")
        
        logger.info(
            f"Batch rider change: {updated_count} updated, {failed_count} failed "
            f"(by {request.user.username or request.user.id})"
        )
        
        return Response({
            'success': updated_count > 0,
            'message': f'Updated {updated_count} shipment(s), {failed_count} failed',
            'updated_count': updated_count,
            'failed_count': failed_count,
            'results': results
        })
    
    @action(detail=True, methods=['get'], url_path='pdf-document')
    def pdf_document(self, request, pk=None):
        """
        Get PDF document for signing (if available)
        Returns PDF URL or generates one if template exists
        """
        shipment = self.get_object()
        
        # Check if PDF already exists
        if shipment.signed_pdf_url:
            return Response({
                'success': True,
                'pdf_url': shipment.signed_pdf_url,
                'is_signed': True
            })
        
        if shipment.pdf_url:
            return Response({
                'success': True,
                'pdf_url': shipment.pdf_url,
                'is_signed': False
            })
        
        # Try to get PDF from acknowledgment settings
        if shipment.region:
            try:
                settings = AcknowledgmentSettings.objects.get(region=shipment.region, is_active=True)
                if settings.pdf_template_url:
                    return Response({
                        'success': True,
                        'pdf_url': settings.pdf_template_url,
                        'is_signed': False,
                        'is_template': True
                    })
            except AcknowledgmentSettings.DoesNotExist:
                pass
        
        return Response({
            'success': False,
            'message': 'No PDF document available for this shipment'
        }, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'], url_path='upload-signed-pdf')
    def upload_signed_pdf(self, request, pk=None):
        """
        Upload signed PDF document
        """
        shipment = self.get_object()
        
        signed_pdf_url = request.data.get('signed_pdf_url')
        if not signed_pdf_url:
            return Response(
                {'success': False, 'message': 'signed_pdf_url is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        shipment.signed_pdf_url = signed_pdf_url
        shipment.synced_to_external = False
        shipment.sync_status = 'pending'
        shipment.save()
        self._sync_shipment_to_pops(shipment, request)
        
        return Response({
            'success': True,
            'message': 'Signed PDF uploaded successfully',
            'signed_pdf_url': signed_pdf_url
        })
    
    @action(detail=True, methods=['get'], url_path='acknowledgment-settings')
    def acknowledgment_settings(self, request, pk=None):
        """
        Get acknowledgment settings for this shipment's region
        """
        shipment = self.get_object()
        
        if not shipment.region:
            # Try to infer region from address
            if shipment.address and isinstance(shipment.address, dict):
                region = shipment.address.get('city') or shipment.address.get('state')
            else:
                region = None
            
            if not region:
                return Response({
                    'success': False,
                    'message': 'No region found for this shipment',
                    'settings': None
                })
        else:
            region = shipment.region
        
        try:
            settings = AcknowledgmentSettings.objects.get(region=region, is_active=True)
            return Response({
                'success': True,
                'settings': AcknowledgmentSettingsSerializer(settings).data
            })
        except AcknowledgmentSettings.DoesNotExist:
            # Return default settings
            return Response({
                'success': True,
                'settings': {
                    'signature_required': 'optional',
                    'photo_required': 'optional',
                    'require_pdf': False,
                    'allow_skip_acknowledgment': False
                }
            })
    
    @action(detail=False, methods=['patch'])
    def batch(self, request):
        """Batch update shipments"""
        updates = request.data.get('updates', [])
        if not isinstance(updates, list) or not updates:
            return Response(
                {'error': 'Updates array is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updated_count = 0
        failed_count = 0
        skipped_count = 0
        results = []
        is_manager = _is_manager_user(request.user)
        processed_ids = set()
        for update_data in updates:
            if not isinstance(update_data, dict):
                failed_count += 1
                results.append({
                    'shipment_id': None,
                    'success': False,
                    'message': 'Invalid update payload. Each update must be an object.'
                })
                continue

            shipment_id = update_data.get('id')
            if not shipment_id:
                failed_count += 1
                results.append({
                    'shipment_id': None,
                    'success': False,
                    'message': 'Shipment id is required for each update.'
                })
                continue
            shipment_key = str(shipment_id)
            if shipment_key in processed_ids:
                skipped_count += 1
                results.append({
                    'shipment_id': shipment_id,
                    'success': True,
                    'message': 'Duplicate update ignored.'
                })
                continue
            processed_ids.add(shipment_key)
            
            try:
                shipment = Shipment.objects.get(id=shipment_id)
                requested_status = update_data.get('status')
                if not requested_status:
                    failed_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': 'Status is required.'
                    })
                    continue
                if requested_status == 'Delivered' and shipment.type != 'delivery':
                    failed_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': 'Cannot mark a pickup shipment as Delivered'
                    })
                    continue
                if requested_status == 'Picked Up' and shipment.type != 'pickup':
                    failed_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': 'Cannot mark a delivery shipment as Picked Up'
                    })
                    continue
                if requested_status == 'Collected' and shipment.type == 'pickup':
                    failed_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': 'Use Picked Up for pickup/store-pickup shipments; Collected is for rider collection flow.'
                    })
                    continue
                if requested_status == shipment.status:
                    skipped_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': True,
                        'message': f'No update required. Shipment already {shipment.status}.'
                    })
                    continue
                if (
                    requested_status in ACK_REQUIRED_STATUS_VALUES
                    and not is_manager
                    and not _has_required_acknowledgment(shipment)
                ):
                    failed_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': DELIVERY_ACK_REQUIRED_MESSAGE
                    })
                    continue
                if (
                    requested_status == 'Skipped'
                    and not str(update_data.get('remarks', '')).strip()
                ):
                    failed_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': SKIPPED_REASON_REQUIRED_MESSAGE
                    })
                    continue

                serializer = ShipmentUpdateSerializer(shipment, data=update_data, partial=True)
                if serializer.is_valid():
                    shipment = serializer.save()
                    shipment.synced_to_external = False
                    shipment.sync_status = 'pending'
                    shipment.save()
                    self._sync_shipment_to_pops(shipment, request)
                    updated_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': True,
                        'message': f'Status updated to {shipment.status}'
                    })
                else:
                    failed_count += 1
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': serializer.errors
                    })
            except Shipment.DoesNotExist:
                failed_count += 1
                results.append({'shipment_id': shipment_id, 'success': False, 'message': 'Shipment not found'})
                continue
        
        return Response({
            'success': updated_count > 0,
            'updated': updated_count,
            'updatedCount': updated_count,
            'failed': failed_count,
            'failedCount': failed_count,
            'skipped': skipped_count,
            'skippedCount': skipped_count,
            'message': f'Processed {len(results)} updates: {updated_count} updated, {skipped_count} skipped, {failed_count} failed.',
            'results': results
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
        collected = queryset.filter(status='Collected').count()
        delivered = queryset.filter(status='Delivered').count()
        picked_up = queryset.filter(status='Picked Up').count()
        returned = queryset.filter(status='Returned').count()
        cancelled = queryset.filter(status='Cancelled').count()
        
        # In Progress metric: Collected + In Transit
        in_progress = queryset.filter(status__in=['Collected', 'In Transit']).count()
        
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
            'collected_shipments': collected,
            'in_progress_shipments': in_progress,
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

    @staticmethod
    def _resolve_employee_name_map(employee_ids):
        """
        Resolve display names for employee IDs from rider/user tables.
        Falls back to employee ID when no display name is available.
        """
        if not employee_ids:
            return {}

        employee_names = {}
        try:
            from apps.authentication.models import RiderAccount, User

            riders = RiderAccount.objects.filter(
                rider_id__in=employee_ids
            ).values('rider_id', 'name')
            for rider in riders:
                if rider.get('name'):
                    employee_names[rider['rider_id']] = rider['name']

            users = User.objects.filter(
                employee_id__in=employee_ids
            ).values('employee_id', 'full_name', 'first_name', 'last_name', 'username')
            for user in users:
                employee_id = user.get('employee_id')
                if not employee_id or employee_id in employee_names:
                    continue

                full_name = (
                    user.get('full_name')
                    or f"{user.get('first_name', '').strip()} {user.get('last_name', '').strip()}".strip()
                    or user.get('username')
                )
                if full_name:
                    employee_names[employee_id] = full_name
        except Exception as exc:
            logger.warning("Failed resolving employee display names: %s", exc)

        return employee_names
    
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

        # Automatically transition all 'Collected' shipments to 'In Transit'
        from .services import ShipmentStatusService
        collected_shipments = Shipment.objects.filter(
            employee_id=user.employee_id,
            status='Collected'
        )
        transitioned_count = 0
        for shipment in collected_shipments:
            ShipmentStatusService.update_status(
                shipment=shipment,
                new_status='In Transit',
                triggered_by=f"route-start-{session_id}"
            )
            transitioned_count += 1

        logger.info(
            "Route session started: %s by %s. %d collected shipments moved to In Transit.",
            session_id,
            user.employee_id,
            transitioned_count
        )
        
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

        event_type = serializer.validated_data['event_type']
        shipment_id = serializer.validated_data['shipment_id']

        shipment = None
        if event_type in ACK_REQUIRED_EVENT_TYPES:
            try:
                shipment = Shipment.objects.get(id=shipment_id)
            except Shipment.DoesNotExist:
                return Response(
                    {'success': False, 'message': 'Shipment not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if not _is_manager_user(user) and not _has_required_acknowledgment(shipment):
                return Response(
                    {'success': False, 'message': DELIVERY_ACK_REQUIRED_MESSAGE},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create tracking point for event
        tracking = RouteTracking.objects.create(
            session=session,
            employee_id=user.employee_id,
            latitude=serializer.validated_data['latitude'],
            longitude=serializer.validated_data['longitude'],
            timestamp=timezone.now(),
            event_type=event_type,
            shipment_id=shipment_id
        )
        
        # Update shipment status if needed using centralized service
        try:
            from .services import ShipmentStatusService
            if shipment is None:
                shipment = Shipment.objects.get(id=shipment_id)
            triggered_by = f"{request.user.username or request.user.id}" if hasattr(request, 'user') else 'gps_tracking'
            
            if event_type == 'delivery':
                shipment.actual_delivery_time = timezone.now()
                shipment.save()
                ShipmentStatusService.update_status(
                    shipment=shipment,
                    new_status='Delivered',
                    triggered_by=triggered_by,
                    metadata={'gps_tracking_id': tracking.id},
                    sync_to_pops=True
                )
            elif event_type == 'pickup':
                new_status = 'Picked Up' if shipment.type == 'pickup' else 'Collected'
                ShipmentStatusService.update_status(
                    shipment=shipment,
                    new_status=new_status,
                    triggered_by=triggered_by,
                    metadata={'gps_tracking_id': tracking.id},
                    sync_to_pops=True
                )
        except Shipment.DoesNotExist:
            pass
        
        logger.info(f'Shipment event recorded: {event_type} for {shipment_id}')
        
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

    @action(detail=False, methods=['get'])
    def visualization_data(self, request):
        """
        Return visualization payload from route session + tracking tables.
        """
        user = request.user
        employee_id = request.query_params.get('employeeId')
        start_date = request.query_params.get('startDate')
        end_date = request.query_params.get('endDate')
        date = request.query_params.get('date')

        sessions_qs = RouteSession.objects.all().prefetch_related('tracking_points')

        if employee_id:
            sessions_qs = sessions_qs.filter(employee_id=employee_id)
        elif not (user.is_superuser or user.is_ops_team or user.is_staff):
            if user.employee_id:
                sessions_qs = sessions_qs.filter(employee_id=user.employee_id)
            else:
                sessions_qs = sessions_qs.none()

        if date:
            sessions_qs = sessions_qs.filter(start_time__date=date)
        elif start_date and end_date:
            sessions_qs = sessions_qs.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)

        sessions_qs = sessions_qs.order_by('-start_time')
        sessions = list(sessions_qs)

        employee_ids = list({session.employee_id for session in sessions if session.employee_id})
        employee_name_map = self._resolve_employee_name_map(employee_ids)

        session_payload = []
        route_data_payload = []
        for session in sessions:
            employee_name = employee_name_map.get(session.employee_id) or f"Employee {session.employee_id}"
            points = []
            for point in session.tracking_points.all().order_by('timestamp'):
                points.append({
                    'id': str(point.id),
                    'sessionId': session.id,
                    'employeeId': point.employee_id,
                    'latitude': point.latitude,
                    'longitude': point.longitude,
                    'timestamp': point.timestamp.isoformat() if point.timestamp else None,
                    'eventType': point.event_type,
                    'shipmentId': point.shipment_id,
                    'accuracy': point.accuracy,
                    'speed': point.speed,
                })

            session_payload.append({
                'id': session.id,
                'employeeId': session.employee_id,
                'employeeName': employee_name,
                'startTime': session.start_time.isoformat() if session.start_time else None,
                'endTime': session.end_time.isoformat() if session.end_time else None,
                'status': session.status,
                'totalDistance': float(session.total_distance or 0),
                'totalTime': int(session.total_time or 0),
                'averageSpeed': float(session.average_speed or 0),
                'fuelConsumed': float(session.fuel_consumed or 0),
                'fuelCost': float(session.fuel_cost or 0),
                'shipmentsCompleted': int(session.shipments_completed or 0),
                'startLatitude': session.start_latitude,
                'startLongitude': session.start_longitude,
                'endLatitude': session.end_latitude,
                'endLongitude': session.end_longitude,
                'createdAt': session.created_at.isoformat() if session.created_at else None,
                'updatedAt': session.updated_at.isoformat() if session.updated_at else None,
                'points': points,
            })

            shipments_completed = int(session.shipments_completed or 0)
            total_distance = float(session.total_distance or 0)
            route_data_payload.append({
                'id': session.id,
                'routeId': session.id,
                'employeeId': session.employee_id,
                'employeeName': employee_name,
                'date': session.start_time.date().isoformat() if session.start_time else None,
                'distance': total_distance,
                'totalDistance': total_distance,
                'duration': int(session.total_time or 0),
                'totalTime': int(session.total_time or 0),
                'shipmentsCompleted': shipments_completed,
                'fuelConsumption': float(session.fuel_consumed or 0),
                'fuelConsumed': float(session.fuel_consumed or 0),
                'fuelCost': float(session.fuel_cost or 0),
                'averageSpeed': float(session.average_speed or 0),
                'efficiency': (total_distance / shipments_completed) if shipments_completed > 0 else 0,
                'points': points,
            })

        return Response({
            'success': True,
            'sessions': session_payload,
            'routeData': route_data_payload,
            'count': len(session_payload),
        })
    
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
        """Get all active riders with live path + current drop points (admin/manager only)."""
        user = request.user
        if not (user.is_superuser or user.is_ops_team or user.is_staff):
            return Response(
                {'success': False, 'message': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        active_sessions = list(
            RouteSession.objects.filter(
                status='active',
                current_latitude__isnull=False,
                current_longitude__isnull=False,
            ).values(
                'id',
                'employee_id',
                'current_latitude',
                'current_longitude',
                'last_updated',
                'start_time',
            )
        )

        if not active_sessions:
            return Response({
                'success': True,
                'riders': [],
                'locations': [],  # Backward-compatible alias
                'count': 0,
            })

        session_ids = [session['id'] for session in active_sessions]
        employee_ids = [session['employee_id'] for session in active_sessions if session.get('employee_id')]
        employee_name_map = self._resolve_employee_name_map(employee_ids)

        tracking_points = RouteTracking.objects.filter(
            session_id__in=session_ids
        ).values(
            'session_id',
            'latitude',
            'longitude',
            'timestamp',
            'event_type',
            'shipment_id',
        ).order_by('timestamp')

        route_points_by_session = defaultdict(list)
        for point in tracking_points:
            route_points_by_session[point['session_id']].append({
                'lat': point['latitude'],
                'lng': point['longitude'],
                'timestamp': point['timestamp'].isoformat() if point['timestamp'] else None,
                'event_type': point.get('event_type'),
                'shipment_id': point.get('shipment_id'),
            })

        active_drop_statuses = ['Assigned', 'Collected', 'In Transit', 'Initiated', 'Picked Up']
        active_drop_shipments = Shipment.objects.filter(
            employee_id__in=employee_ids,
            status__in=active_drop_statuses,
            latitude__isnull=False,
            longitude__isnull=False,
        ).values(
            'employee_id',
            'id',
            'pops_order_id',
            'status',
            'type',
            'latitude',
            'longitude',
            'address',
        )

        drop_points_by_employee = defaultdict(list)
        for shipment in active_drop_shipments:
            address_obj = shipment.get('address')
            if isinstance(address_obj, dict):
                address_text = (
                    address_obj.get('formattedAddress')
                    or address_obj.get('address')
                    or address_obj.get('displayAddress')
                    or ''
                )
            else:
                address_text = str(address_obj or '')

            drop_points_by_employee[shipment['employee_id']].append({
                'id': str(shipment['id']),
                'shipment_id': str(shipment.get('pops_order_id') or shipment['id']),
                'status': shipment.get('status'),
                'type': shipment.get('type'),
                'lat': shipment['latitude'],
                'lng': shipment['longitude'],
                'address': address_text,
            })

        riders_payload = []
        for session in active_sessions:
            employee_id = session.get('employee_id')
            route_points = route_points_by_session.get(session['id'], [])
            # Keep payload bounded for real-time polling.
            if len(route_points) > 300:
                route_points = route_points[-300:]

            riders_payload.append({
                'employee_id': employee_id,
                'employee_name': employee_name_map.get(employee_id) or f'Employee {employee_id}',
                'latitude': session['current_latitude'],
                'longitude': session['current_longitude'],
                'timestamp': session['last_updated'].isoformat() if session['last_updated'] else None,
                'session_id': session['id'],
                'start_time': session['start_time'].isoformat() if session['start_time'] else None,
                'status': 'active',
                'route': route_points,
                'drop_points': drop_points_by_employee.get(employee_id, []),
            })

        return Response({
            'success': True,
            'riders': riders_payload,
            'locations': riders_payload,  # Backward-compatible alias
            'count': len(riders_payload),
        })

    @action(detail=False, methods=['post'])
    def optimize_path(self, request):
        """Optimize route path using a nearest-neighbor heuristic."""
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
            # Haversine distance in km
            radius_km = 6371
            dlat = math.radians(p2[0] - p1[0])
            dlon = math.radians(p2[1] - p1[1])
            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(math.radians(p1[0]))
                * math.cos(math.radians(p2[0]))
                * math.sin(dlon / 2) ** 2
            )
            c = 2 * math.asin(math.sqrt(a))
            return radius_km * c

        while remaining_locations:
            nearest_idx = 0
            min_dist = float('inf')

            for idx, loc in enumerate(remaining_locations):
                dist = calculate_distance(current_pos, (loc['latitude'], loc['longitude']))
                if dist < min_dist:
                    min_dist = dist
                    nearest_idx = idx

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
        employee_id = (
            getattr(user, 'employee_id', None)
            or getattr(user, 'username', None)
            or str(getattr(user, 'id', ''))
        )
            
        # Filter shipments assigned to this employee that are not yet delivered/cancelled.
        # Include collected/picked-up states so drop points stay visible after rider actions.
        shipments_qs = Shipment.objects.filter(
            employee_id__iexact=employee_id,
            status__in=['Assigned', 'Collected', 'In Transit', 'Initiated', 'Picked Up']
        ).order_by('created_at')
        
        # Geocode any shipment missing lat/long (e.g. customer delivery address when POPS didn't send coords)
        from .geocoding import geocode_address
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
        """Record event for multiple shipments at once."""
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
        triggered_by = f"{request.user.username or request.user.id}" if hasattr(request, 'user') else 'gps_tracking'
        is_manager = _is_manager_user(user)

        from .services import ShipmentStatusService

        results = []
        success_count = 0
        processed_ids = set()
        for shipment_id in shipment_ids:
            shipment_key = str(shipment_id)
            if shipment_key in processed_ids:
                results.append({
                    'shipment_id': shipment_id,
                    'success': True,
                    'message': 'Duplicate shipment id ignored.'
                })
                continue
            processed_ids.add(shipment_key)
            try:
                shipment = Shipment.objects.get(id=shipment_id)
                if (
                    shipment.employee_id
                    and user.employee_id
                    and shipment.employee_id.lower() != user.employee_id.lower()
                ):
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': 'Shipment is not assigned to this rider.'
                    })
                    continue
                if event_type == 'delivery' and shipment.type == 'pickup':
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': 'Cannot record delivery event for pickup shipment.'
                    })
                    continue
                if (
                    event_type in ACK_REQUIRED_EVENT_TYPES
                    and not is_manager
                    and not _has_required_acknowledgment(shipment)
                ):
                    results.append({
                        'shipment_id': shipment_id,
                        'success': False,
                        'message': DELIVERY_ACK_REQUIRED_MESSAGE
                    })
                    continue

                RouteTracking.objects.create(
                    session=session,
                    employee_id=user.employee_id,
                    latitude=lat,
                    longitude=lng,
                    timestamp=timezone.now(),
                    event_type=event_type,
                    shipment_id=shipment_id
                )

                if event_type == 'delivery':
                    shipment.actual_delivery_time = timezone.now()
                    shipment.save(update_fields=['actual_delivery_time'])
                    ShipmentStatusService.update_status(
                        shipment=shipment,
                        new_status='Delivered',
                        triggered_by=triggered_by,
                        metadata={'bulk_event': True},
                        sync_to_pops=True
                    )
                elif event_type == 'pickup':
                    new_status = 'Picked Up' if shipment.type == 'pickup' else 'Collected'
                    ShipmentStatusService.update_status(
                        shipment=shipment,
                        new_status=new_status,
                        triggered_by=triggered_by,
                        metadata={'bulk_event': True},
                        sync_to_pops=True
                    )
                success_count += 1
                results.append({'shipment_id': shipment_id, 'success': True})
            except Shipment.DoesNotExist:
                results.append({'shipment_id': shipment_id, 'success': False, 'message': 'Not found'})

        return Response({
            'success': success_count > 0,
            'results': results,
            'message': f'Processed {len(results)} shipment events',
            'updated': success_count,
            'failed': len(results) - success_count
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
    
    @action(detail=False, methods=['post'], url_path='google-maps-route')
    def google_maps_route(self, request):
        """
        Generate Google Maps deep link URL for Android navigation with multiple waypoints
        Expected payload: {
            "shipment_ids": [1, 2, 3],
            "start_location": {"latitude": 12.9716, "longitude": 77.5946},  # Optional
            "optimize": true  # Optional, default true
        }
        """
        shipment_ids = request.data.get('shipment_ids', [])
        start_location = request.data.get('start_location')
        optimize = request.data.get('optimize', True)
        
        if not shipment_ids:
            return Response(
                {'error': 'shipment_ids is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            shipments = Shipment.objects.filter(id__in=shipment_ids)
            if not shipments.exists():
                return Response(
                    {'error': 'No shipments found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            from .services import RoutePlanningService
            
            start_tuple = None
            if start_location:
                start_tuple = (start_location.get('latitude'), start_location.get('longitude'))
            
            url = RoutePlanningService.generate_google_maps_url(
                shipments=list(shipments),
                start_location=start_tuple,
                optimize=optimize
            )
            
            return Response({
                'success': True,
                'url': url,
                'shipment_count': shipments.count()
            })
        except Exception as e:
            logger.error(f"Failed to generate Google Maps route: {e}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
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
                'session_id': session.id,
                'employee_id': session.employee_id,
                'start_time': session.start_time.isoformat() if session.start_time else None,
                'end_time': session.end_time.isoformat() if session.end_time else None,
                'status': session.status,
                'total_points': total_points,
                'total_distance': float(total_distance),
                'total_time': int(total_time),
                'average_speed': float(average_speed),
                'fuel_consumed': float(fuel_consumed),
                'fuel_cost': float(fuel_cost),
                'shipments_completed': int(shipments_completed),
                'efficiency': efficiency,
                'start_latitude': session.start_latitude,
                'start_longitude': session.start_longitude,
                'end_latitude': session.end_latitude,
                'end_longitude': session.end_longitude
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
