"""
Services for shipment delivery - location tracking for users
Consolidated from routes app
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import RouteSession, RouteTracking

logger = logging.getLogger(__name__)
User = get_user_model()


class LocationTrackingService:
    """
    Service for tracking user/rider locations in real-time
    """
    
    @staticmethod
    def track_location(user_id: str, latitude: float, longitude: float, 
                      accuracy: Optional[float] = None, speed: Optional[float] = None,
                      session_id: Optional[str] = None) -> Optional[RouteTracking]:
        """
        Track user location
        
        Args:
            user_id: User/employee ID
            latitude: GPS latitude
            longitude: GPS longitude
            accuracy: GPS accuracy in meters
            speed: Speed in m/s
            session_id: Optional route session ID
        
        Returns:
            Created RouteTracking record, or None if failed
        """
        try:
            # Get or create active session if session_id not provided
            if not session_id:
                active_session = RouteSession.objects.filter(
                    employee_id=user_id,
                    status='active'
                ).order_by('-start_time').first()
                
                if active_session:
                    session_id = active_session.id
                else:
                    # Create new session automatically
                    session_id = f'sess-{int(timezone.now().timestamp() * 1000)}-{user_id}'
                    active_session = RouteSession.objects.create(
                        id=session_id,
                        employee_id=user_id,
                        start_latitude=latitude,
                        start_longitude=longitude,
                        start_time=timezone.now(),
                        status='active'
                    )
                    logger.info(f"Auto-created route session {session_id} for location tracking")
            
            # Get session
            try:
                session = RouteSession.objects.get(id=session_id, employee_id=user_id)
            except RouteSession.DoesNotExist:
                logger.warning(f"Session {session_id} not found for user {user_id}")
                return None
            
            # Create tracking point
            tracking = RouteTracking.objects.create(
                session=session,
                employee_id=user_id,
                latitude=latitude,
                longitude=longitude,
                timestamp=timezone.now(),
                accuracy=accuracy,
                speed=speed,
                event_type='gps'
            )
            
            return tracking
            
        except Exception as e:
            logger.error(f"Failed to track location: {e}", exc_info=True)
            return None
    
    @staticmethod
    def get_user_current_location(user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user's current location (latest tracking point)
        
        Args:
            user_id: User/employee ID
        
        Returns:
            Latest location data, or None if not found
        """
        try:
            latest_tracking = RouteTracking.objects.filter(
                employee_id=user_id
            ).order_by('-timestamp').first()
            
            if latest_tracking:
                return {
                    'latitude': latest_tracking.latitude,
                    'longitude': latest_tracking.longitude,
                    'timestamp': latest_tracking.timestamp.isoformat(),
                    'accuracy': latest_tracking.accuracy,
                    'speed': latest_tracking.speed,
                    'session_id': latest_tracking.session_id
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get user location: {e}")
            return None
    
    @staticmethod
    def get_active_riders_locations() -> list:
        """
        Get locations of all active riders
        
        Returns:
            List of rider locations
        """
        try:
            # Get all active route sessions
            active_sessions = RouteSession.objects.filter(status='active')
            
            locations = []
            for session in active_sessions:
                latest_tracking = session.tracking_points.order_by('-timestamp').first()
                if latest_tracking:
                    locations.append({
                        'employee_id': session.employee_id,
                        'latitude': latest_tracking.latitude,
                        'longitude': latest_tracking.longitude,
                        'timestamp': latest_tracking.timestamp.isoformat(),
                        'session_id': session.id,
                        'start_time': session.start_time.isoformat()
                    })
            
            return locations
            
        except Exception as e:
            logger.error(f"Failed to get active riders locations: {e}")
            return []


# Singleton instance
location_tracking = LocationTrackingService()


# POPS Order Receiver Service
class PopsOrderReceiver:
    """
    Service for receiving and processing orders from POPS
    """
    
    @staticmethod
    def receive_order_from_pops(order_data: dict, rider_id: str):
        """
        Receive order from POPS and create shipment
        
        Args:
            order_data: POPS Order data (can be raw POPS order or transformed shipment)
            rider_id: Rider/employee ID
        
        Returns:
            Created Shipment instance, or None if failed
        """
        from .models import Shipment
        
        try:
            # Handle both raw POPS order format and transformed shipment format
            # Transformed format has: id, type, status, deliveryAddress, recipientName, etc.
            # Raw format has: id, type, is_pickup, locationId, contactPoint, etc.
            
            shipment_id = str(order_data.get('id') or order_data.get('order_id', ''))
            if not shipment_id:
                logger.error("Order data missing ID")
                return None
            
            # Determine shipment type
            order_type = order_data.get('type', 'delivery').lower()
            is_pickup = order_data.get('is_pickup', False) or order_type == 'pickup'
            shipment_type = 'pickup' if is_pickup else 'delivery'
            
            # Extract customer info (handle both formats)
            customer_name = (
                order_data.get('recipientName') or 
                order_data.get('customerName') or 
                (order_data.get('contactPoint', {}).get('name') if isinstance(order_data.get('contactPoint'), dict) else '') or
                ''
            )
            customer_mobile = (
                order_data.get('recipientPhone') or 
                order_data.get('customerMobile') or 
                (order_data.get('contactPoint', {}).get('phone') if isinstance(order_data.get('contactPoint'), dict) else '') or
                ''
            )
            
            # Extract address (handle both formats)
            address = (
                order_data.get('deliveryAddress') or 
                order_data.get('address') or 
                ''
            )
            
            # Extract coordinates (may need geocoding if not present)
            latitude = order_data.get('latitude')
            longitude = order_data.get('longitude')
            
            # Extract cost
            cost = float(order_data.get('cost', 0) or 0)
            
            # Extract route name
            route_name = order_data.get('routeName') or order_data.get('route', '')
            
            # Extract delivery time
            delivery_time_str = order_data.get('estimatedDeliveryTime') or order_data.get('deliveryTime')
            if delivery_time_str:
                try:
                    # Try parsing ISO format first
                    if isinstance(delivery_time_str, str):
                        if 'T' in delivery_time_str:
                            delivery_time_str = delivery_time_str.replace('Z', '+00:00')
                            delivery_time = datetime.fromisoformat(delivery_time_str)
                        else:
                            delivery_time = timezone.now()
                    elif isinstance(delivery_time_str, (int, float)):
                        delivery_time = datetime.fromtimestamp(delivery_time_str, tz=timezone.utc)
                    else:
                        delivery_time = timezone.now()
                except Exception:
                    delivery_time = timezone.now()
            else:
                delivery_time = timezone.now()
            
            # Extract status
            status = order_data.get('status', 'Assigned')
            
            # Check if shipment already exists
            shipment, created = Shipment.objects.get_or_create(
                id=shipment_id,
                defaults={
                    'type': shipment_type,
                    'customer_name': customer_name,
                    'customer_mobile': customer_mobile,
                    'address': address,
                    'latitude': latitude,
                    'longitude': longitude,
                    'cost': cost,
                    'delivery_time': delivery_time,
                    'route_name': route_name,
                    'employee_id': rider_id,
                    'status': status,
                    'pops_order_id': order_data.get('id'),
                    'pops_shipment_uuid': order_data.get('uuid'),
                    'sync_status': 'synced',
                    'synced_to_external': True,
                }
            )
            
            if not created:
                # Update existing shipment
                shipment.employee_id = rider_id
                shipment.status = status
                shipment.sync_status = 'synced'
                shipment.synced_to_external = True
                if address:
                    shipment.address = address
                if customer_name:
                    shipment.customer_name = customer_name
                if customer_mobile:
                    shipment.customer_mobile = customer_mobile
                shipment.save()
            
            logger.info(f"Order received from POPS: {shipment_id} for rider {rider_id}")
            return shipment
            
        except Exception as e:
            logger.error(f"Failed to receive order from POPS: {e}", exc_info=True)
            return None
    
    @staticmethod
    def update_shipment_status_from_pops(shipment_id: str, status_value: str, pops_order_id: int = None):
        """
        Update shipment status from POPS
        
        Args:
            shipment_id: Shipment ID
            status_value: New status from POPS
            pops_order_id: POPS order ID (optional)
        
        Returns:
            True if successful, False otherwise
        """
        from .models import Shipment
        
        try:
            shipment = Shipment.objects.get(id=shipment_id)
            
            # Map POPS status to Shipment status
            status_mapping = {
                'ASSIGNED': 'Assigned',
                'IN_TRANSIT': 'In Transit',
                'DELIVERED': 'Delivered',
                'PICKED_UP': 'Picked Up',
                'RETURNED': 'Returned',
                'CANCELLED': 'Cancelled',
            }
            
            mapped_status = status_mapping.get(status_value.upper(), status_value)
            shipment.status = mapped_status
            shipment.sync_status = 'synced'
            shipment.synced_to_external = True
            shipment.save()
            
            logger.info(f"Shipment {shipment_id} status updated to {mapped_status}")
            return True
            
        except Shipment.DoesNotExist:
            logger.error(f"Shipment {shipment_id} not found")
            return False
        except Exception as e:
            logger.error(f"Failed to update shipment status: {e}", exc_info=True)
            return False


# Singleton instance
pops_order_receiver = PopsOrderReceiver()
