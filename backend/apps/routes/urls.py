"""
URLs for routes app - matches Node.js endpoint structure
"""
from django.urls import path
from .views import RouteSessionViewSet

urlpatterns = [
    # Matches Node.js endpoints
    path('routes/start', RouteSessionViewSet.as_view({'post': 'start'}), name='route-start'),
    path('routes/stop', RouteSessionViewSet.as_view({'post': 'stop'}), name='route-stop'),
    path('routes/coordinates', RouteSessionViewSet.as_view({'post': 'coordinates'}), name='route-coordinates'),
    path('routes/coordinates/batch', RouteSessionViewSet.as_view({'post': 'coordinates_batch'}), name='route-coordinates-batch'),
    path('routes/shipment-event', RouteSessionViewSet.as_view({'post': 'shipment_event'}), name='route-shipment-event'),
    path('routes/session/<str:pk>', RouteSessionViewSet.as_view({'get': 'session'}), name='route-session'),
    path('routes/sync-session', RouteSessionViewSet.as_view({'post': 'sync_session'}), name='route-sync-session'),
    path('routes/sync-coordinates', RouteSessionViewSet.as_view({'post': 'sync_coordinates'}), name='route-sync-coordinates'),
    
    # Location tracking endpoints
    path('routes/track-location', RouteSessionViewSet.as_view({'post': 'track_location'}), name='route-track-location'),
    path('routes/current-location', RouteSessionViewSet.as_view({'get': 'current_location'}), name='route-current-location'),
    path('routes/active-riders', RouteSessionViewSet.as_view({'get': 'active_riders'}), name='route-active-riders'),
]

