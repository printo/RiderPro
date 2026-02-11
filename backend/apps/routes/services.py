"""
Services for route tracking - location tracking for users
"""
import logging
from typing import Dict, Any, Optional
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
        Get user's current location (latest tracking point)
        
        Args:
            user_id: User/employee ID
        
        Returns:
            Latest location data, or None if not found
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






