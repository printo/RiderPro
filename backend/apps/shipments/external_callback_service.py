"""
External Callback Service
Sends shipment status updates to external systems based on their callback URLs
"""
import logging
import requests
from django.conf import settings
from django.utils import timezone
from typing import Dict, Optional, Any
import json

logger = logging.getLogger(__name__)


class ExternalCallbackService:
    """
    Service for sending shipment updates to external systems
    """
    
    @staticmethod
    def get_client_config(api_source: str) -> Optional[Dict[str, Any]]:
        """
        Get client configuration by API source
        
        Args:
            api_source: The API source identifier
            
        Returns:
            Client configuration dict or None if not found
        """
        api_keys_config = getattr(settings, 'RIDER_PRO_API_KEYS', {})
        
        if isinstance(api_keys_config, dict) and api_source in api_keys_config:
            config = api_keys_config[api_source]
            if isinstance(config, dict):
                return config
        
        return None
    
    @staticmethod
    def send_shipment_update(shipment, status_change: str = None, event_type: str = "status_update") -> bool:
        """
        Send shipment update to external system
        
        Args:
            shipment: Shipment instance
            status_change: Description of status change (optional)
            event_type: Type of event (status_update, delivery_confirmation, etc.)
            
        Returns:
            True if successful, False otherwise
        """
        if not shipment.api_source:
            logger.debug(f"Shipment {shipment.id} has no API source, skipping callback")
            return True  # Not an error, just no callback needed
        
        client_config = ExternalCallbackService.get_client_config(shipment.api_source)
        if not client_config:
            logger.warning(f"No client config found for API source: {shipment.api_source}")
            return False
        
        if not client_config.get("active", True):
            logger.debug(f"Client {shipment.api_source} is inactive, skipping callback")
            return True
        
        callback_url = client_config.get("callback_url")
        if not callback_url:
            logger.warning(f"No callback URL configured for API source: {shipment.api_source}")
            return False
        
        # Prepare the payload
        payload = {
            "event": event_type,
            "timestamp": timezone.now().isoformat(),
            "shipment": {
                "id": shipment.id,
                "status": shipment.status,
                "type": shipment.type,
                "customer_name": shipment.customer_name,
                "customer_mobile": shipment.customer_mobile,
                "address": shipment.address,
                "employee_id": shipment.employee_id,
                "route_name": shipment.route_name,
                "delivery_time": shipment.delivery_time.isoformat() if shipment.delivery_time else None,
                "actual_delivery_time": shipment.actual_delivery_time.isoformat() if shipment.actual_delivery_time else None,
                "cost": float(shipment.cost) if shipment.cost else 0,
                "latitude": shipment.latitude,
                "longitude": shipment.longitude,
                "km_travelled": float(shipment.km_travelled) if shipment.km_travelled else 0,
                "remarks": shipment.remarks,
                "signature_url": shipment.signature_url,
                "photo_url": shipment.photo_url,
                "acknowledgment_captured_at": shipment.acknowledgment_captured_at.isoformat() if shipment.acknowledgment_captured_at else None,
                "created_at": shipment.created_at.isoformat(),
                "updated_at": shipment.updated_at.isoformat()
            }
        }
        
        if status_change:
            payload["status_change"] = status_change
        
        # Send the callback
        try:
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "RiderPro-Callback/1.0",
                "X-RiderPro-Source": "status_update",
                "X-RiderPro-Shipment-ID": shipment.id,
                "X-RiderPro-Event": event_type
            }
            
            # Add authentication if configured
            auth_header = client_config.get("auth_header")
            if auth_header:
                headers["Authorization"] = auth_header
            
            logger.info(f"Sending callback to {callback_url} for shipment {shipment.id}")
            
            response = requests.post(
                callback_url,
                json=payload,
                headers=headers,
                timeout=30,  # 30 second timeout
                verify=True  # Verify SSL certificates
            )
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"Callback successful for shipment {shipment.id}: {response.status_code}")
                return True
            else:
                logger.warning(f"Callback failed for shipment {shipment.id}: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.Timeout:
            logger.error(f"Callback timeout for shipment {shipment.id} to {callback_url}")
            return False
        except requests.exceptions.ConnectionError:
            logger.error(f"Callback connection error for shipment {shipment.id} to {callback_url}")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Callback request error for shipment {shipment.id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error in callback for shipment {shipment.id}: {e}")
            return False
    
    @staticmethod
    def send_batch_update(shipments, event_type: str = "batch_status_update") -> Dict[str, bool]:
        """
        Send batch updates to external systems
        Groups shipments by API source and sends batch updates
        
        Args:
            shipments: List of shipment instances
            event_type: Type of event
            
        Returns:
            Dict mapping shipment IDs to success status
        """
        results = {}
        
        # Group shipments by API source
        shipments_by_source = {}
        for shipment in shipments:
            if shipment.api_source:
                if shipment.api_source not in shipments_by_source:
                    shipments_by_source[shipment.api_source] = []
                shipments_by_source[shipment.api_source].append(shipment)
        
        # Send updates for each source
        for api_source, source_shipments in shipments_by_source.items():
            client_config = ExternalCallbackService.get_client_config(api_source)
            if not client_config or not client_config.get("active", True):
                for shipment in source_shipments:
                    results[shipment.id] = False
                continue
            
            callback_url = client_config.get("callback_url")
            if not callback_url:
                for shipment in source_shipments:
                    results[shipment.id] = False
                continue
            
            # Prepare batch payload
            payload = {
                "event": event_type,
                "timestamp": timezone.now().isoformat(),
                "shipments": []
            }
            
            for shipment in source_shipments:
                payload["shipments"].append({
                    "id": shipment.id,
                    "status": shipment.status,
                    "type": shipment.type,
                    "customer_name": shipment.customer_name,
                    "employee_id": shipment.employee_id,
                    "route_name": shipment.route_name,
                    "actual_delivery_time": shipment.actual_delivery_time.isoformat() if shipment.actual_delivery_time else None,
                    "km_travelled": float(shipment.km_travelled) if shipment.km_travelled else 0,
                    "remarks": shipment.remarks,
                    "updated_at": shipment.updated_at.isoformat()
                })
            
            # Send batch callback
            try:
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "RiderPro-Callback/1.0",
                    "X-RiderPro-Source": "batch_update",
                    "X-RiderPro-Event": event_type,
                    "X-RiderPro-Batch-Size": str(len(source_shipments))
                }
                
                auth_header = client_config.get("auth_header")
                if auth_header:
                    headers["Authorization"] = auth_header
                
                logger.info(f"Sending batch callback to {callback_url} for {len(source_shipments)} shipments")
                
                response = requests.post(
                    callback_url,
                    json=payload,
                    headers=headers,
                    timeout=60,  # Longer timeout for batch
                    verify=True
                )
                
                success = response.status_code in [200, 201, 202]
                for shipment in source_shipments:
                    results[shipment.id] = success
                
                if success:
                    logger.info(f"Batch callback successful for {len(source_shipments)} shipments: {response.status_code}")
                else:
                    logger.warning(f"Batch callback failed for {len(source_shipments)} shipments: {response.status_code}")
                    
            except Exception as e:
                logger.error(f"Batch callback error for {api_source}: {e}")
                for shipment in source_shipments:
                    results[shipment.id] = False
        
        return results
    
    @staticmethod
    def test_callback_url(api_source: str) -> Dict[str, Any]:
        """
        Test callback URL for a specific API source
        
        Args:
            api_source: The API source identifier
            
        Returns:
            Dict with test results
        """
        client_config = ExternalCallbackService.get_client_config(api_source)
        if not client_config:
            return {
                "success": False,
                "error": f"No configuration found for API source: {api_source}"
            }
        
        callback_url = client_config.get("callback_url")
        if not callback_url:
            return {
                "success": False,
                "error": "No callback URL configured"
            }
        
        # Send test payload
        test_payload = {
            "event": "test",
            "timestamp": timezone.now().isoformat(),
            "message": "Test callback from RiderPro",
            "api_source": api_source
        }
        
        try:
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "RiderPro-Callback/1.0",
                "X-RiderPro-Source": "test",
                "X-RiderPro-Event": "test"
            }
            
            auth_header = client_config.get("auth_header")
            if auth_header:
                headers["Authorization"] = auth_header
            
            response = requests.post(
                callback_url,
                json=test_payload,
                headers=headers,
                timeout=30,
                verify=True
            )
            
            return {
                "success": response.status_code in [200, 201, 202],
                "status_code": response.status_code,
                "response_text": response.text[:500],  # Limit response text
                "callback_url": callback_url
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "callback_url": callback_url
            }