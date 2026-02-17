"""
URLs for shipments app - matches Node.js endpoint structure
Includes route tracking and sync URLs (consolidated from routes and sync apps)
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ShipmentViewSet, DashboardViewSet,
    RouteSessionViewSet, SyncViewSet
)
from .analytics_views import (
    route_analytics, employee_analytics, route_metrics,
    time_based_analytics, fuel_analytics, top_performers, hourly_activity
)
from .api_source_analytics import api_source_analytics, api_source_timeline
from .callback_views import (
    list_callback_configs, test_callback, send_manual_callback, 
    send_batch_callbacks, callback_analytics
)
from .webhooks import receive_order_webhook, receive_shipments_batch_webhook, order_status_webhook
from . import admin_views

router = DefaultRouter()
router.register(r'shipments', ShipmentViewSet, basename='shipment')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'sync', SyncViewSet, basename='sync')

urlpatterns = [
    # Custom endpoints matching Node.js structure
    path('shipments/fetch', ShipmentViewSet.as_view({'get': 'fetch'}), name='shipments-fetch'),
    path('shipments/create', ShipmentViewSet.as_view({'post': 'create'}), name='shipments-create'),
    path('shipments/receive', receive_order_webhook, name='shipments-receive'),  # Alias for webhook
    path('shipments/batch', ShipmentViewSet.as_view({'patch': 'batch'}), name='shipments-batch'),
    path('shipments/batch-change-rider', ShipmentViewSet.as_view({'post': 'batch_change_rider'}), name='shipments-batch-change-rider'),
    path('shipments/available-riders', ShipmentViewSet.as_view({'get': 'available_riders'}), name='shipments-available-riders'),
    path('shipments/available-routes', ShipmentViewSet.as_view({'get': 'available_routes'}), name='shipments-available-routes'),
    path('shipments/<str:pk>/remarks', ShipmentViewSet.as_view({'post': 'remarks'}), name='shipments-remarks'),
    path('shipments/<str:pk>/acknowledgement', ShipmentViewSet.as_view({'post': 'acknowledgement'}), name='shipments-acknowledgement'),
    path('shipments/<str:pk>/tracking', ShipmentViewSet.as_view({'patch': 'tracking'}), name='shipments-tracking'),
    path('shipments/<str:pk>/pdf-document', ShipmentViewSet.as_view({'get': 'pdf_document'}), name='shipments-pdf-document'),
    path('shipments/<str:pk>/upload-signed-pdf', ShipmentViewSet.as_view({'post': 'upload_signed_pdf'}), name='shipments-upload-signed-pdf'),
    path('shipments/<str:pk>/acknowledgment-settings', ShipmentViewSet.as_view({'get': 'acknowledgment_settings'}), name='shipments-acknowledgment-settings'),
    
    # Route tracking endpoints (consolidated from routes app)
    # Alias route to ensure /api/v1/routes/shipments resolves to rider-route payload.
    path('shipments', RouteSessionViewSet.as_view({'get': 'shipments'}), name='route-shipments-alias'),
    path('routes/start', RouteSessionViewSet.as_view({'post': 'start'}), name='route-start'),
    path('routes/shipments', RouteSessionViewSet.as_view({'get': 'shipments'}), name='route-shipments'),
    path('routes/stop', RouteSessionViewSet.as_view({'post': 'stop'}), name='route-stop'),
    path('routes/coordinates', RouteSessionViewSet.as_view({'post': 'coordinates'}), name='route-coordinates'),
    path('routes/coordinates/batch', RouteSessionViewSet.as_view({'post': 'coordinates_batch'}), name='route-coordinates-batch'),
    path('routes/shipment-event', RouteSessionViewSet.as_view({'post': 'shipment_event'}), name='route-shipment-event'),
    path('routes/optimize_path', RouteSessionViewSet.as_view({'post': 'optimize_path'}), name='route-optimize-path'),
    path('routes/bulk_shipment_event', RouteSessionViewSet.as_view({'post': 'bulk_shipment_event'}), name='route-bulk-shipment-event'),
    path('routes/visualization', RouteSessionViewSet.as_view({'get': 'visualization_data'}), name='route-visualization-data'),
    path('routes/session/<str:pk>', RouteSessionViewSet.as_view({'get': 'session'}), name='route-session'),
    path('routes/sync-session', RouteSessionViewSet.as_view({'post': 'sync_session'}), name='route-sync-session'),
    path('routes/sync-coordinates', RouteSessionViewSet.as_view({'post': 'sync_coordinates'}), name='route-sync-coordinates'),
    path('routes/track-location', RouteSessionViewSet.as_view({'post': 'track_location'}), name='route-track-location'),
    path('routes/current-location', RouteSessionViewSet.as_view({'get': 'current_location'}), name='route-current-location'),
    path('routes/active-riders', RouteSessionViewSet.as_view({'get': 'active_riders'}), name='route-active-riders'),
    path('routes/active/<str:employee_id>', RouteSessionViewSet.as_view({'get': 'active_session'}), name='route-active-session'),
    path('routes/analytics', route_analytics, name='route-analytics'),
    path('routes/session/<str:pk>/summary', RouteSessionViewSet.as_view({'get': 'session_summary'}), name='route-session-summary'),
    
    # Analytics endpoints
    path('analytics/employees', employee_analytics, name='analytics-employees'),
    path('analytics/routes', route_metrics, name='analytics-routes'),
    path('analytics/time/<str:group_by>', time_based_analytics, name='analytics-time'),
    path('analytics/fuel', fuel_analytics, name='analytics-fuel'),
    path('analytics/top-performers/<str:metric>', top_performers, name='analytics-top-performers'),
    path('analytics/activity/hourly', hourly_activity, name='analytics-hourly'),
    path('analytics/api-sources', api_source_analytics, name='analytics-api-sources'),
    path('analytics/api-sources/timeline', api_source_timeline, name='analytics-api-sources-timeline'),
    path('analytics/callbacks', callback_analytics, name='analytics-callbacks'),
    
    # Callback management endpoints
    path('callbacks/configs', list_callback_configs, name='callback-configs'),
    path('callbacks/test', test_callback, name='callback-test'),
    path('callbacks/send', send_manual_callback, name='callback-send'),
    path('callbacks/send-batch', send_batch_callbacks, name='callback-send-batch'),
    
    # Webhooks for receiving orders from POPS
    path('webhooks/receive-order', receive_order_webhook, name='receive-order-webhook'),
    path('webhooks/receive-shipments-batch', receive_shipments_batch_webhook, name='receive-shipments-batch-webhook'),
    path('webhooks/order-status', order_status_webhook, name='order-status-webhook'),
    
    # Admin endpoints
    path('admin/access-tokens', admin_views.access_tokens, name='admin-access-tokens'),

    # Standard CRUD endpoints (keep last so explicit custom routes win)
    path('', include(router.urls)),
]

