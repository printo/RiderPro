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
            # Prepare tags from rider_type and dispatch_option
            tags_list = []
            if rider.rider_type:
                tags_list.append(rider.rider_type)
            if rider.dispatch_option:
                tags_list.append(rider.dispatch_option)
            
            tags = ",".join(tags_list)
            
            # Prepare homebase ID for POPS
            # POPS expects integer PK or hb_id string ID
            homebase_id = None
            if rider.primary_homebase:
                homebase_id = rider.primary_homebase.pops_homebase_id \
                             or rider.primary_homebase.homebase_id
            
            # Prepare rider data for POPS
            rider_data = {
                'rider_id': rider.rider_id,
                'name': rider.full_name,
                'phone': '', # Phone not currently stored in RiderAccount
                'account_code': '', 
                'tags': tags,
                'homebaseId': homebase_id
            }
            
            logger.info(f"Syncing rider {rider.rider_id} to POPS with data: {rider_data}")
            
            # Call POPS API to create or update rider
            if rider.pops_rider_id:
                # Update existing rider
                pops_data = pops_client.update_rider(rider.pops_rider_id, rider_data, access_token)
            else:
                # Create new rider
                pops_data = pops_client.create_rider(rider_data, access_token)
            
            if pops_data:
                # Update local record with POPS response
                rider.pops_rider_id = pops_data.get('id')
                rider.synced_to_pops = True
                rider.save()
                
                # Update any junction records if needed
                from apps.authentication.models import RiderHomebaseAssignment
                if rider.primary_homebase:
                    assignment, created = RiderHomebaseAssignment.objects.get_or_create(
                        rider=rider,
                        homebase=rider.primary_homebase,
                        defaults={'is_primary': True, 'is_active': True}
                    )
                    assignment.pops_rider_id = rider.pops_rider_id
                    assignment.synced_to_pops = True
                    assignment.save()
                
                logger.info(f"Rider {rider.rider_id} synced to POPS successfully (POPS ID: {rider.pops_rider_id})")
                return pops_data
            else:
                logger.error(f"POPS sync failed for rider {rider.rider_id}")
                rider.synced_to_pops = False
                rider.save()
                return None
                
        except Exception as e:
            logger.error(f"POPS rider sync error for {rider.rider_id}: {e}", exc_info=True)
            rider.synced_to_pops = False
            rider.save()
            return None


# Singleton instance
pops_rider_sync = PopsRiderSyncService()






