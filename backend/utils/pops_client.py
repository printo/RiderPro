"""
POPS API Client for integrating with POPS (Printo Order Processing System)
"""
import requests
import logging
from typing import Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)


class PopsAPIClient:
    """Client for interacting with POPS API"""
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or getattr(settings, 'POPS_API_BASE_URL', 'http://localhost:8002/api/v1')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
        })
    
    def login(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate with POPS API
        
        Returns:
            Dict with access, refresh tokens and user data, or None if failed
        """
        url = f"{self.base_url}/auth/"
        try:
            response = self.session.post(url, json={
                'email': email,
                'password': password
            }, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"POPS login failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"POPS login error: {e}")
            return None
            
    def login_with_google(self, id_token: str) -> Dict[str, Any]:
        """
        Authenticate a Google id_token against POPS (GoogleLoginView in the
        pops repo, mounted at /api/v1/auth/google/login/). POPS is the access
        authority: it returns tokens + role flags only for a linked, ACTIVE user.

        Returns a dict with a 'status' key:
          'ok'                 -> {'status', 'data'}  data = access/refresh +
                                  full_name, is_superuser, is_staff, is_ops_team,
                                  is_deliveryq, pia_access, registration_status
          'requires_selection' -> Google email linked to multiple ACTIVE POPS
                                  accounts; no tokens issued
          'denied'             -> {'status', 'code', 'error'}  POPS rejected
                                  (404 not linked, 403 pending approval)
          'unreachable'        -> network error or POPS 5xx; not a rejection
        """
        url = f"{self.base_url}/auth/google/login/"
        try:
            response = self.session.post(url, json={'id_token': id_token}, timeout=10)
        except Exception as e:
            logger.warning(f"POPS Google login unreachable: {e}")
            return {'status': 'unreachable', 'error': str(e)}

        try:
            data = response.json()
        except ValueError:
            data = {}

        if response.status_code == 200:
            if data.get('access'):
                return {'status': 'ok', 'data': data}
            if data.get('requires_selection'):
                return {'status': 'requires_selection', 'data': data}
            logger.error(f"POPS Google login returned 200 without tokens: {data}")
            return {'status': 'denied', 'code': 200, 'error': 'Unexpected POPS response'}

        if response.status_code >= 500:
            logger.warning(f"POPS Google login server error: {response.status_code}")
            return {'status': 'unreachable', 'error': f'POPS returned {response.status_code}'}

        return {
            'status': 'denied',
            'code': response.status_code,
            'error': data.get('error') or data.get('detail') or '',
        }
    
    def refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """
        Refresh access token using refresh token
        
        Returns:
            Dict with new access token, or None if failed
        """
        url = f"{self.base_url}/auth/refresh/"
        try:
            response = self.session.post(url, json={
                'refresh': refresh_token
            }, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"POPS token refresh failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"POPS token refresh error: {e}")
            return None
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify JWT token with POPS API
        
        Returns:
            Dict with user data, or None if invalid
        """
        url = f"{self.base_url}/auth/token-verify/"
        try:
            response = self.session.post(url, json={
                'token': token
            }, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"POPS token verify failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"POPS token verify error: {e}")
            return None

    def get_service_token(self) -> Optional[str]:
        """
        Retrieve a valid POPS service account token.
        It checks the cached self._service_token first, verifies it,
        and if invalid, logs in using settings.POPS_SERVICE_EMAIL and settings.POPS_SERVICE_PASSWORD.
        """
        if not hasattr(self, '_service_token'):
            self._service_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None) or None
            
        # If we have a token, check its validity
        if self._service_token:
            if self.verify_token(self._service_token) is not None:
                return self._service_token
            else:
                logger.info("Cached POPS service token is invalid or expired. Attempting dynamic login.")
                self._service_token = None
                
        # Attempt service account login
        email = getattr(settings, 'POPS_SERVICE_EMAIL', None)
        password = getattr(settings, 'POPS_SERVICE_PASSWORD', None)
        
        if email and password:
            logger.info(f"Logging in to POPS using service account: {email}")
            login_res = self.login(email, password)
            if login_res and login_res.get('access'):
                token = login_res.get('access')
                self._service_token = token
                # Sync back to Django settings so raw accesses are kept in step
                try:
                    setattr(settings, 'RIDER_PRO_SERVICE_TOKEN', token)
                except Exception as e:
                    logger.debug(f"Failed to update RIDER_PRO_SERVICE_TOKEN in settings: {e}")
                return token
            else:
                logger.error("Failed to authenticate service account with POPS.")
        else:
            logger.warning("POPS_SERVICE_EMAIL or POPS_SERVICE_PASSWORD not configured. Cannot perform autologin.")

        return None

    def create_order(self, order_data: Dict[str, Any], access_token: str) -> Optional[Dict[str, Any]]:
        """
        Create order in POPS
        
        Returns:
            Created order data, or None if failed
        """
        url = f"{self.base_url}/deliveryq/request/delivery/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.post(url, json=order_data, headers=headers, timeout=30)
            if response.status_code in [200, 201]:
                return response.json()
            else:
                logger.error(f"POPS create order failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"POPS create order error: {e}")
            return None
    
    def update_order_fields(self, order_id: int, fields_data: Dict[str, Any], access_token: str) -> Optional[Dict[str, Any]]:
        """
        Update mutable Order fields in POPS.
        Uses the RetrieveUpdate endpoint that supports partial updates on Order model.
        """
        url = f"{self.base_url}/deliveryq/{order_id}/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.patch(url, json=fields_data, headers=headers, timeout=30)
            if response.status_code in [200, 201]:
                try:
                    return response.json()
                except ValueError:
                    # A 2xx with an empty / non-JSON body still means POPS accepted
                    # the update — treat as success, not a "returned empty response".
                    return {}

            logger.error(
                "POPS update order fields failed on PATCH endpoint: %s - %s",
                response.status_code,
                response.text,
            )
            return None
        except Exception as e:
            logger.error(f"POPS update order fields error: {e}")
            return None
    
    def create_consignment(self, consignment_data: Dict[str, Any], access_token: str) -> Optional[Dict[str, Any]]:
        """
        Create consignment in POPS
        
        Returns:
            Created consignment data, or None if failed
        """
        url = f"{self.base_url}/deliveryq/consignment/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.post(url, json=consignment_data, headers=headers, timeout=30)
            if response.status_code in [200, 201]:
                return response.json()
            else:
                logger.error(f"POPS create consignment failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"POPS create consignment error: {e}")
            return None
    
    def get_order(self, order_id: int, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Get order from POPS
        
        Returns:
            Order data, or None if not found
        """
        url = f"{self.base_url}/deliveryq/{order_id}/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"POPS get order failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"POPS get order error: {e}")
            return None
    
    def fetch_user_by_email(self, email: str, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Fetch user from POPS by email
        Uses the users list endpoint with email filter
        
        Returns:
            User data dict, or None if not found
        """
        url = f"{self.base_url}/users/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            # Search users by email
            response = self.session.get(url, headers=headers, params={'email': email}, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # If it's a list, find the matching user
                if isinstance(data, list):
                    for user in data:
                        if user.get('email') == email:
                            return user
                    return None
                # If it's a single object
                elif isinstance(data, dict) and data.get('email') == email:
                    return data
                return None
            else:
                logger.error(f"POPS fetch user failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"POPS fetch user error: {e}")
            return None
    
    def fetch_rider_by_id(self, rider_id: str, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Fetch rider from POPS by rider_id
        Uses the master/riders endpoint
        
        POPS Rider model has:
        - name (full name)
        - homebaseId (FK to Homebase)
        - phone
        - rider_id (unique identifier)
        - account_code
        - tags (rider type: milkround, printo-bike, hyperlocal, goods-auto)
        
        Returns:
            Rider data dict, or None if not found
        """
        url = f"{self.base_url}/master/riders/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            # Search riders by rider_id
            # POPS endpoint supports filtering
            response = self.session.get(url, headers=headers, params={'rider_id': rider_id}, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # If it's a list, find the matching rider
                if isinstance(data, list):
                    for rider in data:
                        if rider.get('rider_id') == rider_id:
                            return rider
                    return None
                # If it's a single object
                elif isinstance(data, dict) and data.get('rider_id') == rider_id:
                    return data
                return None
            else:
                logger.error(f"POPS fetch rider failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"POPS fetch rider error: {e}")
            return None
    
    def fetch_rider_by_name(self, name: str, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Fetch rider from POPS by name (search)
        Uses the master/riders endpoint with search
        
        Returns:
            Rider data dict, or None if not found
        """
        url = f"{self.base_url}/master/riders/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            # Search riders by name
            response = self.session.get(url, headers=headers, params={'search': name}, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # If it's a list, find the matching rider by name
                if isinstance(data, list):
                    for rider in data:
                        if rider.get('name') == name:
                            return rider
                    # If exact match not found, return first result
                    if len(data) > 0:
                        return data[0]
                    return None
                # If it's a single object
                elif isinstance(data, dict):
                    return data
                return None
            else:
                logger.error(f"POPS fetch rider by name failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"POPS fetch rider by name error: {e}")
            return None
    
    def fetch_homebases(self, access_token: str) -> tuple[Optional[list], Optional[dict]]:
        """
        Fetch all homebases from POPS
        Uses the master/homebases endpoint
        
        Returns:
            Tuple of (list of homebase data dicts or None, error_details dict or None)
        """
        url = f"{self.base_url}/master/homebases/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # Handle both list and paginated responses
                if isinstance(data, list):
                    return data, None
                elif isinstance(data, dict) and 'results' in data:
                    return data['results'], None
                return [], None
            else:
                logger.error(f"POPS fetch homebases failed: {response.status_code} - {response.text}")
                return None, {'status': response.status_code, 'message': response.text[:200]}
        except Exception as e:
            logger.error(f"POPS fetch homebases error: {e}")
            return None, {'status': 500, 'message': str(e)}
    
    def fetch_riders(self, access_token: str) -> tuple[Optional[list], Optional[dict]]:
        """
        Fetch all riders from POPS
        Uses the master/riders endpoint
        
        Returns:
            Tuple of (list of rider data dicts or None, error_details dict or None)
        """
        url = f"{self.base_url}/master/riders/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    return data, None
                elif isinstance(data, dict) and 'results' in data:
                    return data['results'], None
                return [], None
            else:
                logger.error(f"POPS fetch riders failed: {response.status_code} - {response.text}")
                return None, {'status': response.status_code, 'message': response.text[:200]}
        except Exception as e:
            logger.error(f"POPS fetch riders error: {e}")
            return None, {'status': 500, 'message': str(e)}

    def create_rider(self, rider_data: Dict[str, Any], access_token: str) -> Optional[Dict[str, Any]]:
        """
        Create a rider in POPS
        Uses the master/riders endpoint (POST)
        
        Expected rider_data:
        {
            'name': str,
            'phone': str (optional),
            'rider_id': str,
            'account_code': str (optional),
            'tags': str (optional, comma-separated),
            'homebaseId': int or 'homebaseId__homebaseId': str
        }
        
        Returns:
            Created rider data, or None if failed
        """
        url = f"{self.base_url}/master/riders/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.post(url, json=rider_data, headers=headers, timeout=30)
            if response.status_code in [200, 201]:
                return response.json()
            else:
                logger.error(f"POPS create rider failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"POPS create rider error: {e}")
            return None
            
    def update_rider(self, pops_rider_pk: int, rider_data: Dict[str, Any], access_token: str) -> Optional[Dict[str, Any]]:
        """
        Update a rider in POPS
        Uses the master/riders/:id/ endpoint (PATCH)
        
        Returns:
            Updated rider data, or None if failed
        """
        url = f"{self.base_url}/master/riders/{pops_rider_pk}/"
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = self.session.patch(url, json=rider_data, headers=headers, timeout=30)
            if response.status_code in [200, 201]:
                return response.json()
            else:
                logger.error(f"POPS update rider failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            logger.error(f"POPS update rider error: {e}")
            return None


# Singleton instance
pops_client = PopsAPIClient()


def get_user_pops_token(user) -> Optional[str]:
    """
    Get user's POPS access token, automatically refreshing it if expired
    """
    if not user or not user.is_authenticated:
        return None
        
    access_token = getattr(user, 'access_token', None)
    refresh_token = getattr(user, 'refresh_token', None)
    
    # Try to verify the token first if it exists
    if access_token:
        # Check if the token is valid by verifying it with POPS
        verify_res = pops_client.verify_token(access_token)
        if verify_res is not None:
            # Token is still valid!
            return access_token
            
    # Token is missing or invalid/expired, try to refresh
    if refresh_token:
        logger.info(f"Attempting to refresh POPS token for user {user.username}")
        refresh_res = pops_client.refresh_token(refresh_token)
        if refresh_res and refresh_res.get('access'):
            new_access = refresh_res.get('access')
            new_refresh = refresh_res.get('refresh')
            user.access_token = new_access
            update_fields = ['access_token']
            if new_refresh:
                user.refresh_token = new_refresh
                update_fields.append('refresh_token')
            user.save(update_fields=update_fields)
            logger.info(f"Successfully refreshed POPS token for user {user.username}")
            return new_access
            
    return access_token






