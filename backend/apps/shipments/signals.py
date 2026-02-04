"""
Django signals for shipment status updates
Automatically sends callbacks to external systems when shipments are updated
"""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Shipment
from .external_callback_service import ExternalCallbackService

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Shipment)
def track_shipment_status_change(sender, instance, **kwargs):
    """
    Track status changes before saving
    """
    if instance.pk:  # Only for existing shipments
        try:
            old_instance = Shipment.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
            instance._status_changed = old_instance.status != instance.status
        except Shipment.DoesNotExist:
            instance._old_status = None
            instance._status_changed = False
    else:
        instance._old_status = None
        instance._status_changed = False


@receiver(post_save, sender=Shipment)
def send_shipment_update_callback(sender, instance, created, **kwargs):
    """
    Send callback to external system when shipment is created or updated
    """
    try:
        if created:
            # New shipment created - send creation notification
            logger.info(f"New shipment created: {instance.id}, sending creation callback")
            ExternalCallbackService.send_shipment_update(
                instance, 
                status_change=f"Shipment created with status: {instance.status}",
                event_type="shipment_created"
            )
        elif getattr(instance, '_status_changed', False):
            # Status changed - send status update
            old_status = getattr(instance, '_old_status', 'Unknown')
            status_change = f"Status changed from {old_status} to {instance.status}"
            logger.info(f"Shipment {instance.id} status changed: {status_change}")
            
            ExternalCallbackService.send_shipment_update(
                instance,
                status_change=status_change,
                event_type="status_update"
            )
            
            # Special handling for delivery confirmation
            if instance.status in ['Delivered', 'Picked Up']:
                ExternalCallbackService.send_shipment_update(
                    instance,
                    status_change=status_change,
                    event_type="delivery_confirmation"
                )
        else:
            # Other updates (location, remarks, etc.)
            logger.debug(f"Shipment {instance.id} updated (no status change)")
            ExternalCallbackService.send_shipment_update(
                instance,
                event_type="shipment_updated"
            )
            
    except Exception as e:
        # Don't fail the save operation if callback fails
        logger.error(f"Failed to send callback for shipment {instance.id}: {e}")


# Optional: Signal for batch operations
def send_batch_shipment_callbacks(shipments, event_type="batch_update"):
    """
    Send batch callbacks for multiple shipments
    Can be called manually for batch operations
    """
    try:
        logger.info(f"Sending batch callbacks for {len(shipments)} shipments")
        results = ExternalCallbackService.send_batch_update(shipments, event_type)
        
        success_count = sum(1 for success in results.values() if success)
        logger.info(f"Batch callback results: {success_count}/{len(shipments)} successful")
        
        return results
    except Exception as e:
        logger.error(f"Failed to send batch callbacks: {e}")
        return {}