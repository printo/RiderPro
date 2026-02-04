"""
Views for managing external callbacks
"""
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from .external_callback_service import ExternalCallbackService
from .models import Shipment
from .signals import send_batch_shipment_callbacks

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_callback_configs(request):
    """
    List all configured callback URLs and their status
    """
    try:
        api_keys_config = getattr(settings, 'RIDER_PRO_API_KEYS', {})
        
        configs = []
        for source, config in api_keys_config.items():
            if isinstance(config, dict):
                configs.append({
                    "api_source": source,
                    "callback_url": config.get("callback_url"),
                    "active": config.get("active", True),
                    "has_auth": bool(config.get("auth_header"))
                })
            else:
                # Skip invalid configurations
                logger.warning(f"Invalid configuration format for {source}: expected dict, got {type(config)}")
        
        return Response({
            "success": True,
            "configs": configs
        })
        
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_callback(request):
    """
    Test callback URL for a specific API source
    
    POST body: {"api_source": "pia_api_key"}
    """
    try:
        api_source = request.data.get('api_source')
        if not api_source:
            return Response({
                "success": False,
                "error": "api_source is required"
            }, status=400)
        
        result = ExternalCallbackService.test_callback_url(api_source)
        
        return Response({
            "success": True,
            "test_result": result
        })
        
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_manual_callback(request):
    """
    Manually send callback for a specific shipment
    
    POST body: {"shipment_id": "12345", "event_type": "manual_update"}
    """
    try:
        shipment_id = request.data.get('shipment_id')
        event_type = request.data.get('event_type', 'manual_update')
        
        if not shipment_id:
            return Response({
                "success": False,
                "error": "shipment_id is required"
            }, status=400)
        
        try:
            shipment = Shipment.objects.get(id=shipment_id)
        except Shipment.DoesNotExist:
            return Response({
                "success": False,
                "error": "Shipment not found"
            }, status=404)
        
        success = ExternalCallbackService.send_shipment_update(
            shipment,
            status_change="Manual callback triggered",
            event_type=event_type
        )
        
        return Response({
            "success": True,
            "callback_sent": success,
            "shipment_id": shipment_id,
            "api_source": shipment.api_source
        })
        
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_batch_callbacks(request):
    """
    Send batch callbacks for multiple shipments
    
    POST body: {
        "shipment_ids": ["12345", "12346"],
        "event_type": "batch_manual_update"
    }
    """
    try:
        shipment_ids = request.data.get('shipment_ids', [])
        event_type = request.data.get('event_type', 'batch_manual_update')
        
        if not shipment_ids:
            return Response({
                "success": False,
                "error": "shipment_ids array is required"
            }, status=400)
        
        shipments = Shipment.objects.filter(id__in=shipment_ids)
        found_ids = [s.id for s in shipments]
        missing_ids = [sid for sid in shipment_ids if sid not in found_ids]
        
        if shipments.exists():
            results = send_batch_shipment_callbacks(list(shipments), event_type)
            success_count = sum(1 for success in results.values() if success)
        else:
            results = {}
            success_count = 0
        
        return Response({
            "success": True,
            "total_requested": len(shipment_ids),
            "found_shipments": len(found_ids),
            "missing_shipments": missing_ids,
            "callbacks_sent": success_count,
            "results": results
        })
        
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def callback_analytics(request):
    """
    Get analytics about callback success rates
    """
    try:
        from django.db.models import Count, Q
        from datetime import timedelta
        from django.utils import timezone
        
        # Get query parameters
        days = int(request.GET.get('days', 7))
        
        # Calculate date range
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Get shipments with API sources
        shipments_with_source = Shipment.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date,
            api_source__isnull=False
        ).exclude(api_source='')
        
        # Group by API source
        source_stats = shipments_with_source.values('api_source').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Get callback configurations
        api_keys_config = getattr(settings, 'RIDER_PRO_API_KEYS', {})
        
        analytics = []
        for stat in source_stats:
            api_source = stat['api_source']
            config = api_keys_config.get(api_source, {})
            
            analytics.append({
                "api_source": api_source,
                "shipment_count": stat['count'],
                "has_callback_url": bool(config.get("callback_url")),
                "callback_url": config.get("callback_url"),
                "active": config.get("active", True),
                "callback_enabled": bool(config.get("callback_url")) and config.get("active", True)
            })
        
        return Response({
            "success": True,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "analytics": analytics,
            "summary": {
                "total_sources": len(analytics),
                "sources_with_callbacks": sum(1 for a in analytics if a["callback_enabled"]),
                "total_shipments": sum(a["shipment_count"] for a in analytics)
            }
        })
        
    except Exception as e:
        return Response({
            "success": False,
            "error": str(e)
        }, status=500)