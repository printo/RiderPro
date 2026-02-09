"""
Services for shipment delivery - location tracking for users
Consolidated from routes app
"""
import logging
import uuid
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
    def receive_order_from_pops(order_data: dict, rider_id: str, api_source: str = None):
        """
        Receive order from POPS and create shipment
        
        Args:
            order_data: POPS Order data (can be raw POPS order or transformed shipment)
            rider_id: Rider/employee ID
            api_source: Source of the API call (e.g., printo_api_key_2024)
        
        Returns:
            Created Shipment instance, or None if failed
        """
        from .models import Shipment
        
        try:
            # Handle both raw POPS order format and transformed shipment format
            # Transformed format has: orderId, status, deliveryAddress, recipientName, etc.
            # Raw format has: orderId, is_pickup, locationId, contactPoint, etc.
            
            # Log what we received for debugging
            logger.debug(f"Received order_data with keys: {list(order_data.keys())}")
            logger.debug(f"Order data sample: {str(order_data)[:200]}")
            
            # Get orderId from POPS (changed from 'id' to 'orderId')
            # Try multiple possible keys for backward compatibility
            order_id = (
                order_data.get('orderId') or 
                order_data.get('order_id') or 
                order_data.get('id')  # Fallback for legacy format
            )
            if not order_id:
                logger.error(f"Order data missing orderId. Available keys: {list(order_data.keys())}")
                logger.error(f"Full order_data: {order_data}")
                return None
            
            # Shipment ID will be auto-generated by Django (AutoField)
            # No need to generate it manually
            
            # Don't set type initially - it will be set later when rider picks up
            # Type starts as None/null and becomes "pickup" when rider picks it up
            shipment_type = None
            
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
            
            # Extract address - POPS now sends addresses as JSON objects directly
            # No need to build addresses, just use what POPS sends
            address_json = order_data.get('deliveryAddress')
            pickup_address_json = order_data.get('pickupAddress')
            
            # Ensure addresses are dicts (JSON objects), not strings
            if address_json and isinstance(address_json, str):
                # Legacy format: convert string to dict
                address_json = {"address": address_json}
            if pickup_address_json and isinstance(pickup_address_json, str):
                # Legacy format: convert string to dict
                pickup_address_json = {"address": pickup_address_json}
            
            # Extract coordinates (may need geocoding if not present)
            latitude = order_data.get('latitude')
            longitude = order_data.get('longitude')
            
            # Extract cost
            cost = float(order_data.get('cost', 0) or 0)
            
            # Extract package box information
            package_boxes = order_data.get('packageBoxes', [])
            package_summary = order_data.get('packageSummary', {})
            
            # Extract weight from summary or legacy fields
            weight = float(package_summary.get('total_weight', 0) or order_data.get('weight', 0) or 0)
            
            # Store package boxes as JSON if available
            package_boxes_json = None
            if package_boxes:
                # package_boxes is already a list/dict, JSONField will handle it
                package_boxes_json = package_boxes
            
            # Extract route name
            route_name = order_data.get('routeName') or order_data.get('route', '')
            
            # Format employee_id as "id-name" if it contains a hyphen (already formatted from POPS)
            # If not formatted, try to get name from user
            employee_id_formatted = rider_id
            if rider_id and '-' not in str(rider_id):
                # Try to get user name if employee_id is just an ID
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    # Try to find user by username (which is the email value from estimator) or id
                    try:
                        user = User.objects.get(username=rider_id)
                    except User.DoesNotExist:
                        try:
                            user = User.objects.get(id=int(rider_id))
                        except (ValueError, User.DoesNotExist):
                            user = None
                    
                    if user and user.full_name:
                        employee_id_formatted = f"{rider_id}-{user.full_name.strip()}"
                except Exception as e:
                    logger.debug(f"Could not format employee_id {rider_id}: {e}")
                    employee_id_formatted = rider_id
            
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
            
            # Set status to "Initiated" when receiving from POPS
            status = 'Initiated'
            
            # Check if shipment already exists by pops_order_id (not by id)
            pops_order_id_int = int(order_id) if str(order_id).isdigit() else None
            try:
                if pops_order_id_int:
                    shipment = Shipment.objects.get(pops_order_id=pops_order_id_int)
                    created = False
                else:
                    raise Shipment.DoesNotExist
            except Shipment.DoesNotExist:
                # Create new shipment - ID will be auto-generated (AutoField)
                shipment = Shipment.objects.create(
                    type=shipment_type,  # None initially
                    customer_name=customer_name,
                    customer_mobile=customer_mobile,
                    address=address_json,  # JSON format
                    pickup_address=pickup_address_json,  # JSON format from clickpost logic
                    latitude=latitude,
                    longitude=longitude,
                    cost=cost,
                    delivery_time=delivery_time,
                    route_name=route_name,
                    employee_id=employee_id_formatted,
                    weight=weight,
                    package_boxes=package_boxes_json,
                    status=status,  # "Initiated"
                    pops_order_id=pops_order_id_int,
                    pops_shipment_uuid=order_data.get('uuid'),
                    sync_status='synced',
                    synced_to_external=True,
                    api_source=api_source,  # Track the API source
                )
                created = True
            
            if not created:
                # Update existing shipment - but don't overwrite id or type if already set
                shipment.employee_id = employee_id_formatted
                if weight > 0:
                    shipment.weight = weight
                if package_boxes_json:
                    shipment.package_boxes = package_boxes_json
                # Only update status if it's still "Initiated" or null
                if not shipment.status or shipment.status == 'Initiated':
                    shipment.status = status
                shipment.sync_status = 'synced'
                shipment.synced_to_external = True
                if address_json:
                    shipment.address = address_json
                if pickup_address_json:
                    shipment.pickup_address = pickup_address_json
                if customer_name:
                    shipment.customer_name = customer_name
                if customer_mobile:
                    shipment.customer_mobile = customer_mobile
                # Update API source if provided (for tracking source changes)
                if api_source:
                    shipment.api_source = api_source
                shipment.save()
            
            logger.info(f"Order received from {api_source or 'unknown source'}: orderId={order_id}, shipment_id={shipment.id} for rider {rider_id}")
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
