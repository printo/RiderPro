"""
RiderPro URL Configuration
Matches Node.js backend URL structure
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

@require_http_methods(["GET", "HEAD"])
def health_check(request):
    """Minimal health check endpoint to prevent 404s from browser/service worker checks"""
    return JsonResponse({'status': 'ok'}, status=200)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Health check endpoint (for browser/service worker checks)
    path('api/v1/health', health_check, name='health'),
    
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
    
    # Admin endpoints
    path('api/v1/admin/', include('apps.shipments.urls')),  # Access tokens
]
