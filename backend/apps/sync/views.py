"""
Views for sync app
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.shipments.models import Shipment
from utils.pops_client import pops_client
from django.conf import settings

logger = logging.getLogger(__name__)


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
        # Get pending shipments
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
        
        # Prefer service token for POPS integration; fall back to user token if necessary
        service_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None)

        for shipment in pending_shipments:
            access_token = service_token or getattr(request.user, 'access_token', None)
            if shipment.pops_order_id and access_token:
                try:
                    pops_client.update_order_status(
                        shipment.pops_order_id,
                        {'status': shipment.status},
                        access_token
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
        
        # Prefer service token for POPS integration; fall back to user token if necessary
        service_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None)
        access_token = service_token or getattr(request.user, 'access_token', None)

        if shipment.pops_order_id and access_token:
            try:
                pops_client.update_order_status(
                    shipment.pops_order_id,
                    {'status': shipment.status},
                    access_token
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
        # Prefer service token for POPS integration; fall back to user token if necessary
        service_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None)
        access_token = service_token or getattr(request.user, 'access_token', None)
        for shipment_id in shipment_ids:
            try:
                shipment = Shipment.objects.get(id=shipment_id)
                if shipment.pops_order_id and access_token:
                    pops_client.update_order_status(
                        shipment.pops_order_id,
                        {'status': shipment.status},
                        access_token
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
