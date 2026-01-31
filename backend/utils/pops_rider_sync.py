"""
POPS Rider Sync Service
Handles syncing rider accounts to POPS when approved
"""
import logging
from typing import Optional, Dict, Any
from apps.authentication.models import RiderAccount
from utils.pops_client import pops_client

logger = logging.getLogger(__name__)


class PopsRiderSyncService:
    """Service for syncing riders to POPS"""
    
    @staticmethod
    def sync_rider_to_pops(rider: RiderAccount, access_token: str) -> Optional[Dict[str, Any]]:
        """
        Sync rider account to POPS when approved by manager
        
        Args:
            rider: RiderAccount instance
            access_token: POPS API access token (from manager/admin)
        
        Returns:
            POPS rider data if successful, None if failed
        """
        try:
            # Prepare rider data for POPS
            rider_data = {
                'rider_id': rider.rider_id,
                'full_name': rider.full_name,
                'email': rider.email or f"{rider.rider_id}@rider.local",
                'rider_type': rider.rider_type,
                'is_active': rider.is_active,
                'is_approved': rider.is_approved,
            }
            
            # Call POPS API to create/update rider
            # Note: This endpoint may need to be created in POPS
            # For now, we'll use a placeholder endpoint
            url = f"{pops_client.base_url}/deliveryq/rider/create/"
            headers = {
                'Authorization': f'Bearer {access_token}'
            }
            
            response = pops_client.session.post(
                url,
                json=rider_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                pops_data = response.json()
                rider.pops_rider_id = pops_data.get('id')
                rider.synced_to_pops = True
                rider.pops_sync_error = None
                rider.save()
                
                logger.info(f"Rider {rider.rider_id} synced to POPS successfully")
                return pops_data
            else:
                error_msg = f"POPS sync failed: {response.status_code} - {response.text}"
                rider.synced_to_pops = False
                rider.pops_sync_error = error_msg
                rider.save()
                
                logger.error(error_msg)
                return None
                
        except Exception as e:
            error_msg = f"POPS rider sync error: {e}"
            rider.synced_to_pops = False
            rider.pops_sync_error = error_msg
            rider.save()
            
            logger.error(error_msg)
            return None


# Singleton instance
pops_rider_sync = PopsRiderSyncService()






