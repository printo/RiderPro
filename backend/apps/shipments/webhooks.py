"""
Webhook endpoints for receiving orders from POPS
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from apps.authentication.api_key_auth import APIKeyAuthentication
from .services import pops_order_receiver

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow API key or JWT authentication
@csrf_exempt
def receive_order_webhook(request):
    """
    Webhook endpoint to receive orders from POPS
    Called when an order is assigned to a rider in POPS
    
    Authentication: Accepts either:
    - x-api-key header (API key authentication)
    - Authorization: Bearer <token> (JWT token from POPS)
    
    Expected payload:
    {
        "order": { ... POPS Order data ... },
        "rider_id": "12345",
        "event": "order_assigned"
    }
    """
    # Authentication is handled by DRF authentication classes
    # APIKeyAuthentication (first in list) will check x-api-key header
    # If API key is valid, request.user will be authenticated
    # If no API key or invalid, JWT authentication will be tried
    # For webhooks, we require either valid API key OR valid JWT token
    
    # Check if user is authenticated (via API key or JWT)
    if not request.user or not request.user.is_authenticated:
        # Check what authentication was attempted
        api_key = request.META.get('HTTP_X_API_KEY') or request.META.get('X-API-KEY')
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not api_key and not auth_header:
            return Response(
                {'success': False, 'message': 'Authentication required. Provide x-api-key header or Authorization: Bearer <token>.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        else:
            # Authentication was attempted but failed
            logger.warning(f"Webhook authentication failed. API key provided: {bool(api_key)}, Auth header provided: {bool(auth_header)}")
            return Response(
                {'success': False, 'message': 'Authentication failed. Invalid API key or token.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
    
    try:
        order_data = request.data.get('order', {})
        rider_id = request.data.get('rider_id') or request.data.get('employee_id')
        event = request.data.get('event', 'order_assigned')
        
        if not order_data:
            return Response(
                {'success': False, 'message': 'Order data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not rider_id:
            return Response(
                {'success': False, 'message': 'Rider ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only process order_assigned events
        if event != 'order_assigned':
            return Response({
                'success': True,
                'message': f'Event {event} ignored'
            })
        
        # Receive order and create shipment
        shipment = pops_order_receiver.receive_order_from_pops(order_data, rider_id)
        
        if shipment:
            return Response({
                'success': True,
                'message': 'Order received and shipment created',
                'shipment_id': shipment.id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(
                {'success': False, 'message': 'Failed to create shipment'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except Exception as e:
        logger.error(f"Webhook error: {e}", exc_info=True)
        return Response(
            {'success': False, 'message': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def order_status_webhook(request):
    """
    Webhook endpoint to receive order status updates from POPS
    Called when order status is updated in POPS
    
    Expected payload:
    {
        "order_id": 12345,
        "shipment_id": "uuid-here",
        "status": "DELIVERED",
        "event": "status_updated"
    }
    """
    try:
        order_id = request.data.get('order_id')
        shipment_id = request.data.get('shipment_id')
        status_value = request.data.get('status')
        
        if not order_id or not status_value:
            return Response(
                {'success': False, 'message': 'Order ID and status are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update shipment status
        if shipment_id:
            success = pops_order_receiver.update_shipment_status_from_pops(
                shipment_id, status_value, order_id
            )
        else:
            # Try to find shipment by pops_order_id
            from .models import Shipment
            try:
                shipment = Shipment.objects.get(pops_order_id=order_id)
                success = pops_order_receiver.update_shipment_status_from_pops(
                    shipment.id, status_value, order_id
                )
            except Shipment.DoesNotExist:
                return Response(
                    {'success': False, 'message': 'Shipment not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        if success:
            return Response({
                'success': True,
                'message': 'Shipment status updated'
            })
        else:
            return Response(
                {'success': False, 'message': 'Failed to update shipment status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except Exception as e:
        logger.error(f"Status webhook error: {e}", exc_info=True)
        return Response(
            {'success': False, 'message': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )






