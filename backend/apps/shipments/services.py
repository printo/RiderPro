"""
Shipment services for RiderPro
Includes centralized status change management with event emission
"""
import logging
from typing import Optional, Dict, Any
from django.utils import timezone
from django.conf import settings
from .models import Shipment, OrderEvent, Zone, RouteSession, RouteTracking

logger = logging.getLogger(__name__)


class ShipmentStatusService:
    """
    Centralized service for managing shipment status changes
    Emits events and handles POPS synchronization
    """
    
    @staticmethod
    def update_status(
        shipment: Shipment,
        new_status: str,
        old_status: Optional[str] = None,
        triggered_by: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        sync_to_pops: bool = True
    ) -> tuple[Shipment, OrderEvent]:
        """
        Update shipment status and emit event
        
        Args:
            shipment: Shipment instance to update
            new_status: New status value
            old_status: Previous status (auto-detected if not provided)
            triggered_by: User/system that triggered the change
            metadata: Additional event metadata
            sync_to_pops: Whether to sync to POPS immediately
        
        Returns:
            Tuple of (updated_shipment, created_event)
        """
        if old_status is None:
            old_status = shipment.status
        
        # Update shipment
        shipment.status = new_status
        shipment.synced_to_external = False
        shipment.sync_status = 'pending'
        shipment.save()
        
        # Create event
        event = OrderEvent.objects.create(
            shipment=shipment,
            event_type='status_change',
            old_status=old_status,
            new_status=new_status,
            triggered_by=triggered_by or 'system',
            metadata=metadata or {}
        )
        
        logger.info(
            f"Status updated: Shipment {shipment.id} from '{old_status}' to '{new_status}' "
            f"(Event {event.id}, triggered by {triggered_by or 'system'})"
        )
        
        # Sync to POPS if requested
        if sync_to_pops and shipment.pops_order_id:
            ShipmentStatusService._sync_to_pops(shipment, event, new_status)
        
        return shipment, event
    
    @staticmethod
    def _sync_to_pops(shipment: Shipment, event: OrderEvent, status: str) -> bool:
        """
        Sync status change to POPS
        
        Args:
            shipment: Shipment instance
            event: OrderEvent instance
            status: New status value
        
        Returns:
            True if sync successful, False otherwise
        """
        try:
            from utils.pops_client import pops_client
            
            # Use service token if available
            pops_access_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None)
            if not pops_access_token:
                logger.warning("RIDER_PRO_SERVICE_TOKEN not configured. Cannot sync to POPS.")
                event.sync_error = "RIDER_PRO_SERVICE_TOKEN not configured"
                event.save()
                return False
            
            # Map RiderPro status to POPS status
            status_mapping = {
                'Initiated': 'INITIATED',
                'Assigned': 'ASSIGNED',
                'In Transit': 'IN_TRANSIT',
                'Delivered': 'DELIVERED',
                'Picked Up': 'PICKED_UP',
                'Returned': 'RETURNED',
                'Cancelled': 'CANCELLED',
            }
            
            pops_status = status_mapping.get(status, status.upper())
            
            # Update POPS
            sync_response = pops_client.update_order_status(
                shipment.pops_order_id,
                {
                    'status': pops_status,
                    'type': shipment.type,
                    'rider_id': shipment.employee_id,
                    'event_id': event.id,
                },
                pops_access_token
            )
            if sync_response is None:
                raise ValueError("POPS status update failed")
            
            # Mark as synced
            shipment.synced_to_external = True
            shipment.sync_status = 'synced'
            shipment.sync_attempts = 0
            shipment.last_sync_attempt = timezone.now()
            shipment.save()
            
            event.synced_to_pops = True
            event.sync_attempted_at = timezone.now()
            event.save()
            
            logger.info(f"Successfully synced shipment {shipment.id} status to POPS")
            return True
            
        except Exception as e:
            logger.error(f"Failed to sync shipment {shipment.id} to POPS: {e}", exc_info=True)
            
            shipment.sync_status = 'failed'
            shipment.sync_attempts += 1
            shipment.sync_error = str(e)
            shipment.last_sync_attempt = timezone.now()
            shipment.save()
            
            event.sync_error = str(e)
            event.sync_attempted_at = timezone.now()
            event.save()
            
            return False
    
    @staticmethod
    def create_event(
        shipment: Shipment,
        event_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        triggered_by: Optional[str] = None
    ) -> OrderEvent:
        """
        Create a custom event for a shipment
        
        Args:
            shipment: Shipment instance
            event_type: Type of event (from OrderEvent.EVENT_TYPES)
            metadata: Additional event data
            triggered_by: User/system that triggered the event
        
        Returns:
            Created OrderEvent instance
        """
        event = OrderEvent.objects.create(
            shipment=shipment,
            event_type=event_type,
            metadata=metadata or {},
            triggered_by=triggered_by or 'system'
        )
        
        logger.info(f"Event created: {event_type} for shipment {shipment.id} (Event {event.id})")
        return event


class RoutePlanningService:
    """
    Service for route planning and Google Maps integration
    """
    
    @staticmethod
    def generate_google_maps_url(
        shipments: list[Shipment],
        start_location: Optional[tuple[float, float]] = None,
        optimize: bool = True
    ) -> str:
        """
        Generate Google Maps deep link URL for Android navigation
        
        Args:
            shipments: List of shipments to include in route
            start_location: Optional start location (lat, lng). If not provided, uses first shipment pickup
            optimize: Whether to optimize route order
        
        Returns:
            Google Maps deep link URL
        """
        if not shipments:
            return ""
        
        # Filter shipments with valid coordinates
        valid_shipments = [
            s for s in shipments
            if s.latitude and s.longitude
        ]
        
        if not valid_shipments:
            return ""
        
        # Determine start location
        # Priority: 1) Provided start_location, 2) First shipment's pickup_address coordinates, 3) First shipment's delivery coordinates
        if start_location:
            start_lat, start_lng = start_location
        elif valid_shipments[0].pickup_address:
            # Try to extract from pickup address JSON
            pickup = valid_shipments[0].pickup_address
            if isinstance(pickup, dict):
                # Check if coordinates are directly in pickup address
                start_lat = pickup.get('latitude') or pickup.get('lat')
                start_lng = pickup.get('longitude') or pickup.get('lng') or pickup.get('lon')
                # If not in pickup, use first shipment's delivery coordinates
                if not start_lat or not start_lng:
                    start_lat, start_lng = valid_shipments[0].latitude, valid_shipments[0].longitude
            else:
                # Pickup address is not a dict, use delivery coordinates
                start_lat, start_lng = valid_shipments[0].latitude, valid_shipments[0].longitude
        else:
            # No pickup address, use first shipment's delivery coordinates as start
            start_lat, start_lng = valid_shipments[0].latitude, valid_shipments[0].longitude
        
        # Build waypoints (all delivery locations)
        waypoints = [
            f"{s.latitude},{s.longitude}"
            for s in valid_shipments
        ]
        
        # If we have a start location different from first waypoint, add it
        if start_location and (abs(start_lat - valid_shipments[0].latitude) > 0.001 or 
                               abs(start_lng - valid_shipments[0].longitude) > 0.001):
            # Use first shipment as destination, others as waypoints
            destination = waypoints[0]
            waypoints = waypoints[1:] if len(waypoints) > 1 else []
        else:
            # Last shipment is destination
            destination = waypoints[-1]
            waypoints = waypoints[:-1] if len(waypoints) > 1 else []
        
        # Build Google Maps URL
        # Format: https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&waypoints=lat1,lng1|lat2,lng2
        url = f"https://www.google.com/maps/dir/?api=1"
        url += f"&origin={start_lat},{start_lng}"
        url += f"&destination={destination}"
        
        if waypoints:
            url += f"&waypoints={'|'.join(waypoints)}"
        
        if optimize:
            url += "&dir_action=navigate"  # Opens in navigation mode on Android
        
        return url
    
    @staticmethod
    def assign_to_zone(shipment: Shipment, zone: Optional[Zone] = None, auto_assign: bool = True) -> Optional[Zone]:
        """
        Assign shipment to a zone
        
        Args:
            shipment: Shipment instance
            zone: Zone to assign (if None and auto_assign=True, finds best zone)
            auto_assign: Whether to auto-assign if zone is None
        
        Returns:
            Assigned Zone instance or None
        """
        if zone:
            shipment.zone = zone
            shipment.save()
            return zone
        
        if not auto_assign:
            return None
        
        # Auto-assign based on coordinates
        if shipment.latitude and shipment.longitude:
            # Find zone that contains these coordinates
            zones = Zone.objects.filter(is_active=True)
            for z in zones:
                if RoutePlanningService._point_in_zone(
                    shipment.latitude,
                    shipment.longitude,
                    z.boundaries
                ):
                    shipment.zone = z
                    shipment.save()
                    logger.info(f"Auto-assigned shipment {shipment.id} to zone {z.name}")
                    return z
        
        logger.warning(f"Could not auto-assign shipment {shipment.id} to any zone")
        return None
    
    @staticmethod
    def _point_in_zone(lat: float, lng: float, boundaries: Optional[list]) -> bool:
        """
        Check if a point is inside a zone polygon
        
        Args:
            lat: Latitude
            lng: Longitude
            boundaries: List of [lat, lng] coordinates defining polygon
        
        Returns:
            True if point is inside polygon
        """
        if not boundaries or not isinstance(boundaries, list) or len(boundaries) < 3:
            return False
        
        # Simple point-in-polygon check (ray casting algorithm)
        # This is a simplified version - for production, use a proper geospatial library
        x, y = lng, lat
        n = len(boundaries)
        inside = False
        
        p1x, p1y = boundaries[0]
        for i in range(1, n + 1):
            p2x, p2y = boundaries[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y

class LocationTrackingService:
    """
    Service for tracking user/rider locations in real-time
    """
    
    @staticmethod
    def track_location(user_id: str, latitude: float, longitude: float, 
                      accuracy: Optional[float] = None, speed: Optional[float] = None,
                      session_id: Optional[str] = None) -> Optional[RouteTracking]:
        """
        Track user location and update session cache
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
                        status='active',
                        current_latitude=latitude,
                        current_longitude=longitude,
                        last_updated=timezone.now()
                    )
                    logger.info(f"Auto-created route session {session_id} for location tracking")
            
            # Get session
            try:
                session = RouteSession.objects.get(id=session_id)
                # Verify ownership if needed, but for now trust the ID if found
                if session.employee_id != user_id:
                    logger.warning(f"Session {session_id} belongs to {session.employee_id}, not {user_id}")
                    return None
            except RouteSession.DoesNotExist:
                logger.warning(f"Session {session_id} not found")
                return None
            
            # Create tracking point
            from .models import RouteTracking  # Ensure import is available
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
            
            # Update session current location cache
            session.current_latitude = latitude
            session.current_longitude = longitude
            session.last_updated = timezone.now()
            session.save(update_fields=['current_latitude', 'current_longitude', 'last_updated'])
            
            return tracking
            
        except Exception as e:
            logger.error(f"Failed to track location: {e}", exc_info=True)
            return None
    
    @staticmethod
    def get_user_current_location(user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user's current location (preferred from session cache)
        """
        try:
            # First try to get from active session (faster)
            active_session = RouteSession.objects.filter(
                employee_id=user_id,
                status='active'
            ).order_by('-start_time').first()
            
            if active_session and active_session.current_latitude and active_session.current_longitude:
                return {
                    'latitude': active_session.current_latitude,
                    'longitude': active_session.current_longitude,
                    'timestamp': active_session.last_updated.isoformat() if active_session.last_updated else timezone.now().isoformat(),
                    'accuracy': None, # Session cache doesn't store these
                    'speed': None,
                    'session_id': active_session.id
                }
            
            # Fallback to latest tracking point
            from .models import RouteTracking
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
        """
        try:
            # Get all active route sessions with location data
            # Optimized to avoid N+1 queries by using the cached fields
            active_sessions = RouteSession.objects.filter(
                status='active',
                current_latitude__isnull=False,
                current_longitude__isnull=False
            ).values(
                'employee_id', 'current_latitude', 'current_longitude', 
                'last_updated', 'id', 'start_time'
            )
            
            locations = []
            for session in active_sessions:
                locations.append({
                    'employee_id': session['employee_id'],
                    'latitude': session['current_latitude'],
                    'longitude': session['current_longitude'],
                    'timestamp': session['last_updated'].isoformat() if session['last_updated'] else None,
                    'session_id': session['id'],
                    'start_time': session['start_time'].isoformat()
                })
            
            return locations
            
        except Exception as e:
            logger.error(f"Failed to get active riders locations: {e}")
            return []


# Singleton instance
location_tracking = LocationTrackingService()
