"""
Middleware to add trailing slashes for DRF router endpoints
Prevents POST data loss from CommonMiddleware redirects
"""
from django.utils.deprecation import MiddlewareMixin
from django.urls import resolve, Resolver404


class APIAppendSlashMiddleware(MiddlewareMixin):
    """
    Adds trailing slashes for DRF router endpoints to prevent redirects.
    
    Django's CommonMiddleware redirects POST requests to add trailing slashes,
    which loses POST data. This middleware modifies the request path directly
    for API routes, allowing DRF routers to handle URL matching correctly.
    """
    
    def process_request(self, request):
        # Only process API routes and POST/PUT/PATCH/DELETE
        if (not request.path.startswith('/api/') or 
            request.method not in ('POST', 'PUT', 'PATCH', 'DELETE') or
            request.path.endswith('/')):
            return None
        
        # Try to resolve with trailing slash - if it works, add it
        try:
            resolve(request.path + '/')
            request.path = request.path + '/'
            request.path_info = request.path_info + '/'
            request.META['PATH_INFO'] = request.path_info
        except Resolver404:
            pass  # Not a router endpoint, let Django handle it
        
        return None

