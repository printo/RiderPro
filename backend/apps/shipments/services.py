"""
Shipment services for RiderPro
Includes centralized status change management with event emission
"""
import logging
from typing import Optional, Dict, Any
from django.utils import timezone
from django.conf import settings
from .models import Shipment, OrderEvent, RouteSession, RouteTracking

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
        
        # Update shipment. When the change did NOT originate from us (sync_to_pops
        # is False — i.e. it came FROM POPS), suppress the outbound callback so we
        # don't echo the update straight back to the source (#10 callback loop).
        shipment.status = new_status
        shipment.synced_to_external = False
        shipment.sync_status = 'pending'
        shipment._suppress_callback = not sync_to_pops
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
            
            pops_access_token = pops_client.get_service_token()
            if not pops_access_token:
                logger.warning("POPS service account credentials or token not configured. Cannot sync to POPS.")
                event.sync_error = "POPS service token not configured"
                event.save()
                return False
            
            # Sync via the canonical field-update path: PATCH /deliveryq/{id}/.
            # This is the same path rider/field updates use, and POPS Order
            # partial-updates accept the raw RiderPro status. The previous direct
            # update_order_status call only ever hit the legacy Locus-callback
            # endpoint, which the service account can't use (0 ok / 1581 failed
            # lifetime); the dead status-update fallback was removed since no
            # RiderPro service account has write access to that endpoint.
            # (Still needs POPS-side write permission on the PATCH endpoint.)
            sync_response = pops_client.update_order_fields(
                shipment.pops_order_id,
                {
                    'status': status,
                    'assigned_to': shipment.employee_id,
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


def finalize_session_metrics(session):
    """
    Auto-derive a route session's distance, fuel consumed and petrol cost from
    its GPS trail + the rider's vehicle mileage. Replaces manual start/end-km
    entry for mileage and fuel reimbursement.

    Distance is the sum of consecutive GPS points, filtered for noise:
      - points with poor accuracy (> MAX_ACCURACY_M) are dropped
      - sub-MIN_SEGMENT_KM hops (jitter while parked/idling) are ignored
    This is intentionally conservative — raw, unfiltered summation over-counts.
    Fuel = distance / vehicle mileage (km/l); cost = litres x active fuel price.

    The session instance is saved before returning.
    """
    from apps.vehicles.models import FuelSetting
    from apps.authentication.models import RiderAccount
    from .routing import get_routing_backend

    # --- 1. Distance: real ROAD distance between the rider's CONFIRMED stops
    #        (session start -> each pickup/delivery event in order -> end).
    #        This is robust to GPS-trail gaps that happen when the web app is
    #        backgrounded or closed: the trail may be incomplete, but the
    #        confirmed stops are reliable (the rider taps each one). Falls back
    #        to the filtered GPS trail only when there aren't enough stops. ---
    confirmed_stops = [
        (e['latitude'], e['longitude'])
        for e in (
            session.tracking_points
            .filter(event_type__in=['pickup', 'delivery'])
            .order_by('timestamp')
            .values('latitude', 'longitude')
        )
    ]

    total_km = 0.0
    # Stop-to-stop is only meaningful with at least one CONFIRMED stop to trace
    # the path through. With none, start->end would be a straight line that
    # ignores the real route (e.g. a loop returning near the start), so fall
    # back to the GPS trail in that case.
    if len(confirmed_stops) >= 1:
        stops = []
        if session.start_latitude is not None and session.start_longitude is not None:
            stops.append((session.start_latitude, session.start_longitude))
        stops.extend(confirmed_stops)
        if session.end_latitude is not None and session.end_longitude is not None:
            stops.append((session.end_latitude, session.end_longitude))

        distance_method = 'stop_to_stop'
        try:
            matrix = get_routing_backend().get_distance_matrix(stops)
            total_km = sum(matrix[i][i + 1].distance_km for i in range(len(stops) - 1))
        except Exception as exc:
            logger.warning(f"Stop-to-stop routing failed ({exc}); falling back to GPS trail.")
            total_km = _gps_trail_distance_km(session)
            distance_method = 'gps_trail_fallback'
    else:
        total_km = _gps_trail_distance_km(session)
        distance_method = 'gps_trail'

    # No-regress (#13): finalize runs again on offline sync_session/sync_coordinates.
    # A re-run with partial data, or an ORS hiccup that forces the GPS-trail
    # fallback, must NEVER shrink a rider's recorded distance / pay — keep the
    # larger value (later, more-complete syncs only grow it).
    new_total_km = round(total_km, 3)
    session.total_distance = max(new_total_km, float(session.total_distance or 0))

    # --- 2. Average speed (km/h) ---
    if session.total_time and session.total_time > 0:
        session.average_speed = round(session.total_distance / (session.total_time / 3600.0), 2)

    # --- 3. Fuel consumed + cost, from the rider's vehicle + active fuel price ---
    # Resolve the rider's vehicle (mileage + fuel type) on every finalize — it's a
    # cheap query and we need fuel_type for the price lookup below. Vehicle/mileage
    # live on RiderAccount (keyed by rider_id == session.employee_id); the auth User
    # has no vehicle_type, so query RiderAccount to avoid silently using the default
    # for everyone.
    mileage_km_per_l = 15.0   # fallback if no vehicle is configured
    fuel_type = 'petrol'
    vehicle_label = None
    try:
        rider = (
            RiderAccount.objects.filter(rider_id=session.employee_id)
            .select_related('vehicle_type')
            .first()
        )
        if rider and rider.vehicle_type and rider.vehicle_type.fuel_efficiency:
            mileage_km_per_l = rider.vehicle_type.fuel_efficiency
            fuel_type = rider.vehicle_type.fuel_type or 'petrol'
            vehicle_label = rider.vehicle_type.name
    except Exception as exc:
        logger.warning(f"Could not resolve rider vehicle for fuel calc: {exc}")

    # Snapshot the vehicle + mileage ONCE, on the first finalize, as an IMMUTABLE
    # reimbursement audit trail (#13): a later vehicle change — or a re-run — must
    # not rewrite a past payout. fuel_efficiency_used is always set on first finalize
    # (defaults to 15), so its presence marks "already snapshotted".
    if session.fuel_efficiency_used is None:
        session.vehicle_type_used = vehicle_label
        session.fuel_efficiency_used = mileage_km_per_l

    # Fuel price: snapshot once, but ALLOW a later finalize to fill it if it was
    # missing the first time (e.g. no active FuelSetting had been seeded yet) —
    # otherwise fuel_cost would be stuck at 0 forever even after a price is set.
    # Once captured it stays put (a later price change won't rewrite past pay).
    if session.fuel_price_used is None:
        try:
            fuel_setting = (
                FuelSetting.objects.filter(fuel_type=fuel_type, is_active=True)
                .order_by('-effective_date')
                .first()
            )
            if fuel_setting:
                session.fuel_price_used = fuel_setting.price_per_liter
        except Exception as exc:
            logger.warning(f"Could not resolve active fuel price: {exc}")

    # Recompute fuel from the (possibly grown) distance using the IMMUTABLE snapshot,
    # so a distance update is reflected but a later price/vehicle change is not.
    eff = session.fuel_efficiency_used
    price = session.fuel_price_used
    if eff and eff > 0:
        litres = session.total_distance / eff
        session.fuel_consumed = round(litres, 3)
        if price is not None:
            session.fuel_cost = round(litres * price, 2)

    # --- 4. Shipments completed (#15) ---
    # This was never incremented, so every per-shipment efficiency metric read 0.
    # Derive it from the distinct shipments with a confirmed pickup/delivery event
    # in this session. Events only accumulate, so guard with max for safety.
    completed = (
        session.tracking_points
        .filter(event_type__in=['pickup', 'delivery'])
        .values('shipment_id')
        .distinct()
        .count()
    )
    session.shipments_completed = max(completed, int(session.shipments_completed or 0))

    session.save()
    logger.info(
        f"Session {session.id} finalized via {distance_method}: {session.total_distance} km, "
        f"{session.fuel_consumed} L, cost {session.fuel_cost}, {session.shipments_completed} shipments"
    )
    return session


def _gps_trail_distance_km(session):
    """
    Fallback distance: sum of the GPS trail, filtered for noise.
    Drops poor-accuracy fixes (> 50 m) and sub-10 m hops (stationary jitter).
    Used only when there aren't enough confirmed stops for stop-to-stop routing.
    NOTE: this under-counts when the web app was backgrounded/closed during the
    route (gaps in the trail) — which is exactly why stop-to-stop is preferred.
    """
    import math
    MAX_ACCURACY_M = 50
    MIN_SEGMENT_KM = 0.010
    EARTH_R_KM = 6371.0
    points = list(
        session.tracking_points
        .filter(event_type='gps')
        .order_by('timestamp')
        .values('latitude', 'longitude', 'accuracy')
    )
    total = 0.0
    prev = None
    for p in points:
        if p['accuracy'] is not None and p['accuracy'] > MAX_ACCURACY_M:
            continue
        if prev is not None:
            dlat = math.radians(p['latitude'] - prev['latitude'])
            dlon = math.radians(p['longitude'] - prev['longitude'])
            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(math.radians(prev['latitude']))
                * math.cos(math.radians(p['latitude']))
                * math.sin(dlon / 2) ** 2
            )
            seg = EARTH_R_KM * 2 * math.asin(math.sqrt(max(0.0, a)))
            if seg >= MIN_SEGMENT_KM:
                total += seg
        prev = p
    return total
