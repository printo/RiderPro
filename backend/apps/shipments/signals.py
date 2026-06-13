"""
Django signals for shipment status updates
Automatically sends callbacks to external systems when shipments are updated
"""
import logging
import threading
from django.db import transaction
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


def _dispatch_callback_async(shipment, status_change, event_type):
    """Send one callback on a daemon thread. The send is HTTP-only (touches no DB),
    so a slow/unreachable callback host can't block the request worker (#12)."""
    def _run():
        try:
            ExternalCallbackService.send_shipment_update(
                shipment, status_change=status_change, event_type=event_type
            )
        except Exception as e:
            logger.error(f"Async callback failed for shipment {shipment.id}: {e}")
    threading.Thread(target=_run, daemon=True).start()


@receiver(post_save, sender=Shipment)
def send_shipment_update_callback(sender, instance, created, **kwargs):
    """
    Notify the originating external system on shipment CREATE or STATUS CHANGE.
    Fires AFTER the DB transaction commits (no phantom callback if the txn rolls
    back, #12) and off the request thread (#12); never echoes a change that came
    FROM the external system (#10); and stays silent on plain field updates (#11).
    """
    # #10: don't echo a change that originated from the external system (POPS).
    if getattr(instance, '_suppress_callback', False):
        return

    if created:
        status_change = f"Shipment created with status: {instance.status}"
        event_type = "shipment_created"
    elif getattr(instance, '_status_changed', False):
        old_status = getattr(instance, '_old_status', 'Unknown')
        status_change = f"Status changed from {old_status} to {instance.status}"
        event_type = "status_update"
    else:
        # #11: a plain field update (location, sync flags, remarks) previously fired
        # a duplicate "shipment_updated" callback on every save — don't.
        return

    logger.info(f"Queuing {event_type} callback for shipment {instance.id}")
    # #12: defer until after commit so a rolled-back txn can't fire a phantom callback.
    transaction.on_commit(lambda: _dispatch_callback_async(instance, status_change, event_type))
    # Delivery confirmation is a distinct event the partner expects.
    if (not created) and instance.status in ['Delivered', 'Picked Up']:
        transaction.on_commit(
            lambda: _dispatch_callback_async(instance, status_change, "delivery_confirmation")
        )


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