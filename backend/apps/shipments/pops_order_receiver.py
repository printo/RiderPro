"""
POPS Order Receiver
Handles receiving orders from POPS and creating shipments in RiderPro
"""
import logging
from typing import Optional, Dict, Any
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from .models import Shipment
from .services import ShipmentStatusService

logger = logging.getLogger(__name__)


def receive_order_from_pops(
    order_data: Dict[str, Any],
    employee_id: str,
    api_source: Optional[str] = None
) -> Optional[Shipment]:
    """
    Receive an order from POPS and create a shipment in RiderPro
    
    Args:
        order_data: Order data from POPS (dict with orderId, deliveryAddress, etc.)
        employee_id: Employee/rider ID assigned to this order
        api_source: Source of the API call (for tracking)
    
    Returns:
        Created Shipment instance or None if creation failed
    """
    try:
        # Extract order ID
        order_id = order_data.get('orderId') or order_data.get('order_id')
        if not order_id:
            logger.error("Order data missing orderId")
            return None
        
        # Check if shipment already exists for this order
        existing_shipment = Shipment.objects.filter(pops_order_id=order_id).first()
        if existing_shipment:
            logger.info(f"Shipment already exists for orderId={order_id}, shipment_id={existing_shipment.id}")
            return existing_shipment
        
        # Extract address data
        address = order_data.get('address') or order_data.get('deliveryAddress') or {}
        if isinstance(address, str):
            # If address is a string, convert to dict format
            address = {'formattedAddress': address}
        
        # Extract coordinates from address or separate fields
        latitude = None
        longitude = None
        
        if isinstance(address, dict):
            latitude = address.get('latitude') or address.get('lat')
            longitude = address.get('longitude') or address.get('lng') or address.get('lon')
        
        # Fallback to separate coordinate fields
        if not latitude:
            latitude = order_data.get('latitude') or order_data.get('lat')
        if not longitude:
            longitude = order_data.get('longitude') or order_data.get('lng') or order_data.get('lon')
        
        # Extract pickup address
        pickup_address = order_data.get('pickupAddress') or order_data.get('pickup_address')
        if isinstance(pickup_address, str):
            pickup_address = {'formattedAddress': pickup_address}
        
        # Extract delivery time
        delivery_time_str = order_data.get('deliveryTime') or order_data.get('estimatedDeliveryTime') or order_data.get('delivery_time')
        delivery_time = None
        if delivery_time_str:
            if isinstance(delivery_time_str, str):
                delivery_time = parse_datetime(delivery_time_str)
            elif hasattr(delivery_time_str, 'isoformat'):
                delivery_time = delivery_time_str
        
        # Extract package boxes
        package_boxes = order_data.get('packageBoxes') or order_data.get('package_boxes')
        
        # Extract weight (aggregate from package boxes if available)
        weight = order_data.get('weight', 0)
        if package_boxes and isinstance(package_boxes, list):
            total_weight = sum(box.get('weight', 0) for box in package_boxes if isinstance(box, dict))
            if total_weight > 0:
                weight = total_weight
        
        # Determine shipment type
        shipment_type = order_data.get('type', 'delivery')
        if shipment_type not in ['delivery', 'pickup']:
            shipment_type = 'delivery'  # Default to delivery
        
        # Create shipment
        shipment = Shipment.objects.create(
            pops_order_id=int(order_id) if order_id else None,
            type=shipment_type,
            customer_name=order_data.get('recipientName') or order_data.get('customerName') or '',
            customer_mobile=order_data.get('recipientPhone') or order_data.get('customerMobile') or '',
            address=address if isinstance(address, dict) else {'formattedAddress': str(address)},
            latitude=float(latitude) if latitude else None,
            longitude=float(longitude) if longitude else None,
            pickup_address=pickup_address if isinstance(pickup_address, dict) else None,
            cost=float(order_data.get('cost', 0)),
            delivery_time=delivery_time or timezone.now(),
            route_name=order_data.get('routeName') or order_data.get('route_name') or '',
            employee_id=employee_id if employee_id and employee_id != "N/A" else "unassigned",
            status='Initiated',  # Default status when received from POPS
            weight=float(weight),
            package_boxes=package_boxes if isinstance(package_boxes, (list, dict)) else None,
            special_instructions=order_data.get('specialInstructions') or order_data.get('special_instructions'),
            remarks=order_data.get('remarks'),
            priority=order_data.get('priority', 'medium'),
            api_source=api_source,
            pops_shipment_uuid=order_data.get('shipment_uuid') or order_data.get('pops_shipment_uuid'),
            region=order_data.get('region'),
            synced_to_external=True,  # Mark as synced since it came from POPS
            sync_status='synced'
        )
        
        # Create initial event
        ShipmentStatusService.create_event(
            shipment,
            event_type='order_received',
            metadata={
                'source': 'pops',
                'order_id': order_id,
                'employee_id': employee_id,
                'api_source': api_source
            },
            triggered_by='pops_system'
        )
        
        logger.info(
            f"Order received from {api_source or 'unknown source'}: orderId={order_id}, "
            f"shipment_id={shipment.id} for rider {employee_id}"
        )
        
        return shipment
        
    except Exception as e:
        logger.error(f"Failed to receive order from POPS: {e}", exc_info=True)
        return None


def update_shipment_status_from_pops(
    shipment_id: int,
    status: str,
    order_id: Optional[int] = None
) -> bool:
    """
    Update shipment status from POPS
    
    Args:
        shipment_id: RiderPro shipment ID
        status: New status from POPS
        order_id: Pia order ID (optional, for logging)
    
    Returns:
        True if update successful, False otherwise
    """
    try:
        shipment = Shipment.objects.get(id=shipment_id)
        
        # Map POPS status to RiderPro status
        status_mapping = {
            'INITIATED': 'Initiated',
            'ASSIGNED': 'Assigned',
            'COLLECTED': 'Collected',
            'IN_TRANSIT': 'In Transit',
            'DELIVERED': 'Delivered',
            'PICKED_UP': 'Picked Up',
            'RETURNED': 'Returned',
            'CANCELLED': 'Cancelled',
        }
        
        riderpro_status = status_mapping.get(status.upper(), status)
        
        # Update status using ShipmentStatusService
        ShipmentStatusService.update_status(
            shipment,
            new_status=riderpro_status,
            triggered_by='pops_system',
            metadata={
                'source': 'pops',
                'pops_status': status,
                'order_id': order_id
            },
            sync_to_pops=False  # Don't sync back to POPS since update came from POPS
        )
        
        logger.info(f"Updated shipment {shipment_id} status to {riderpro_status} from POPS")
        return True
        
    except Shipment.DoesNotExist:
        logger.error(f"Shipment {shipment_id} not found")
        return False
    except Exception as e:
        logger.error(f"Failed to update shipment status from POPS: {e}", exc_info=True)
        return False

