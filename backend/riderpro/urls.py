"""
RiderPro URL Configuration
Matches Node.js backend URL structure
"""
from django.contrib import admin
from django.urls import path, include
from apps.health.views import health_check, api_status, log_error

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # All APIs under /api/v1 prefix
    # Authentication
    path('api/v1/auth/', include('apps.authentication.urls')),
    
    # Shipments - matches /api/v1/shipments/* from Node.js
    # Also includes routes and sync (consolidated)
    path('api/v1/shipments/', include('apps.shipments.urls')),
    path('api/v1/dashboard', include('apps.shipments.urls')),  # Dashboard endpoint
    path('api/v1/routes/', include('apps.shipments.urls')),  # Route tracking (consolidated)
    path('api/v1/', include('apps.shipments.urls')),  # Sync endpoints (consolidated)
    
    # Vehicles - matches /api/v1/vehicle-types/* and /api/v1/fuel-settings/* from Node.js
    # Note: DRF router automatically handles trailing slashes, but we ensure both work
    path('api/v1/', include('apps.vehicles.urls')),
    
    # Health - matches /health, /api/v1/health, /api-status from Node.js
    path('health', health_check, name='health'),
    path('api-status', api_status, name='api-status'),
    path('api/v1/health', health_check, name='api-health'),  # Alias for /health at /api/v1/health
    path('api/v1/errors', log_error, name='log-error'),
    
    # Admin endpoints
    path('api/v1/admin/', include('apps.shipments.urls')),  # Access tokens
]
