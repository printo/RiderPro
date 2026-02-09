"""
Webhook endpoints for receiving orders from POPS
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from .services import pops_order_receiver

logger = logging.getLogger(__name__)


def _process_batch_shipments(shipments_data, request=None):
    """
    Process batch shipments from the new array format
    
    Args:
        shipments_data: List of shipment dictionaries
        request: Django request object (optional, for api_key_source)
        
    Returns:
        Response with batch processing results
    """
    if not shipments_data or not isinstance(shipments_data, list):
        return Response(
            {'success': False, 'message': 'Shipments must be a non-empty array'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    results = {
        'success': True,
        'message': 'Batch processing completed',
        'total_shipments': len(shipments_data),
        'processed': 0,
        'failed': 0,
        'shipment_ids': [],
        'errors': []
    }
    
    for i, shipment_data in enumerate(shipments_data):
        try:
            # Validate required fields - use orderId instead of id
            order_id = shipment_data.get('orderId') or shipment_data.get('order_id')
            employee_id = shipment_data.get('employeeId')
            
            if not order_id:
                error_msg = f"Shipment {i+1}: Missing required field 'orderId'"
                results['errors'].append(error_msg)
                results['failed'] += 1
                logger.warning(error_msg)
                continue
                
            # Allow shipments without employeeId - they will use a default
            if not employee_id or employee_id == "N/A":
                # Use a default employeeId if missing
                employee_id = "unassigned"
                logger.warning(f"Shipment {i+1} (orderId: {order_id}): Missing employeeId, using default 'unassigned'")
            
            # Remove 'id' field from shipment_data to prevent it from being used
            # RiderPro will generate its own shipment ID
            shipment_data_clean = {k: v for k, v in shipment_data.items() if k != 'id'}
            
            # Process the shipment
            api_source = getattr(request, 'api_key_source', None) if request else None
            shipment = pops_order_receiver.receive_order_from_pops(
                shipment_data_clean, 
                employee_id, 
                api_source
            )
            
            if shipment:
                results['processed'] += 1
                results['shipment_ids'].append(shipment.id)
                logger.info(f"Successfully processed shipment orderId={order_id}, shipment_id={shipment.id} for employee {employee_id}")
            else:
                error_msg = f"Shipment {i+1} (orderId: {order_id}): Failed to create shipment"
                results['errors'].append(error_msg)
                results['failed'] += 1
                logger.error(error_msg)
                
        except Exception as e:
            error_msg = f"Shipment {i+1}: Error processing - {str(e)}"
            results['errors'].append(error_msg)
            results['failed'] += 1
            logger.error(f"Error processing shipment {i+1}: {e}", exc_info=True)
    
    # Update success status based on results
    if results['failed'] > 0 and results['processed'] == 0:
        # All failed
        results['success'] = False
        results['message'] = 'All shipments failed to process'
        return Response(results, status=status.HTTP_400_BAD_REQUEST)
    elif results['failed'] > 0:
        # Partial success
        results['success'] = True
        results['message'] = f'Partial success: {results["processed"]} processed, {results["failed"]} failed'
        return Response(results, status=status.HTTP_207_MULTI_STATUS)
    else:
        # All successful
        results['message'] = f'All {results["processed"]} shipments processed successfully'
        return Response(results, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow API key or JWT authentication
@csrf_exempt
def receive_order_webhook(request):
    """
    Webhook endpoint to receive orders from POPS
    Called when orders are assigned to riders in POPS
    
    Authentication: Accepts either:
    - x-api-key header (API key authentication)
    - Authorization: Bearer <token> (JWT token from POPS)
    
    Supported payload formats:
    
    1. Single order format (legacy):
    {
        "order": { ... POPS Order data ... },
        "rider_id": "12345",
        "event": "order_assigned"
    }
    
    2. Batch shipments format (new):
    {
        "shipments": [
            {
                "id": "12345",
                "type": "delivery",
                "status": "Assigned",
                "deliveryAddress": "123 Main St...",
                "recipientName": "John Doe",
                "recipientPhone": "9876543210",
                "estimatedDeliveryTime": "2023-10-27T10:00:00+00:00",
                "cost": 150.0,
                "routeName": "Route A",
                "employeeId": "EMP001",
                "pickupAddress": "..." // Optional for pickup orders
            }
        ]
    }
    """
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
        # Check for new batch shipments format
        shipments_data = request.data.get('shipments', [])
        
        if shipments_data:
            # Process batch shipments format
            return _process_batch_shipments(shipments_data, request)
        
        # Fall back to legacy single order format
        order_data = request.data.get('order', {})
        rider_id = request.data.get('rider_id') or request.data.get('employee_id')
        event = request.data.get('event', 'order_assigned')
        
        # Log what we received for debugging
        logger.info(f"Received webhook request. Keys in request.data: {list(request.data.keys())}")
        logger.info(f"Order data keys: {list(order_data.keys()) if order_data else 'None'}")
        logger.info(f"Order data orderId: {order_data.get('orderId') if order_data else 'N/A'}")
        
        if not order_data:
            return Response(
                {'success': False, 'message': 'Either "shipments" array or "order" data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not rider_id:
            return Response(
                {'success': False, 'message': 'Rider ID is required for single order format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only process order_assigned events
        if event != 'order_assigned':
            return Response({
                'success': True,
                'message': f'Event {event} ignored'
            })
        
        # Remove 'id' field from order_data to prevent it from being used
        # RiderPro will generate its own shipment ID
        # But preserve 'orderId' which is what we need
        order_data_clean = {k: v for k, v in order_data.items() if k != 'id'}
        
        # Receive order and create shipment
        shipment = pops_order_receiver.receive_order_from_pops(
            order_data_clean, 
            rider_id, 
            getattr(request, 'api_key_source', None)
        )
        
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







@api_view(['POST'])
@permission_classes([AllowAny])  # Allow API key or JWT authentication
@csrf_exempt
def receive_shipments_batch_webhook(request):
    """
    Dedicated webhook endpoint for batch shipments processing
    
    Authentication: Accepts either:
    - x-api-key header (API key authentication)
    - Authorization: Bearer <token> (JWT token from external source)
    
    Expected payload:
    {
        "shipments": [
            {
                "id": "12345",
                "type": "delivery",
                "status": "Assigned",
                "deliveryAddress": "123 Main St, Bangalore, KA 560001, India",
                "recipientName": "John Doe",
                "recipientPhone": "9876543210",
                "estimatedDeliveryTime": "2023-10-27T10:00:00+00:00",
                "cost": 150.0,
                "routeName": "Route A",
                "employeeId": "EMP001",
                "pickupAddress": "..." // Optional for pickup orders
            }
        ]
    }
    """
    # Check authentication
    if not request.user or not request.user.is_authenticated:
        api_key = request.META.get('HTTP_X_API_KEY') or request.META.get('X-API-KEY')
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not api_key and not auth_header:
            return Response(
                {'success': False, 'message': 'Authentication required. Provide x-api-key header or Authorization: Bearer <token>.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        else:
            logger.warning(f"Batch webhook authentication failed. API key provided: {bool(api_key)}, Auth header provided: {bool(auth_header)}")
            return Response(
                {'success': False, 'message': 'Authentication failed. Invalid API key or token.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
    
    try:
        shipments_data = request.data.get('shipments', [])
        
        if not shipments_data:
            return Response(
                {'success': False, 'message': 'Shipments array is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return _process_batch_shipments(shipments_data, request)
        
    except Exception as e:
        logger.error(f"Batch webhook error: {e}", exc_info=True)
        return Response(
            {'success': False, 'message': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )