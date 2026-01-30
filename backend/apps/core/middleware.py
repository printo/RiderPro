"""
Custom middleware for API routes
Prevents APPEND_SLASH redirect for API routes to avoid POST data loss
"""
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponse


class APIAppendSlashMiddleware(MiddlewareMixin):
    """
    Middleware to prevent APPEND_SLASH redirect for API routes.
    
    Django's CommonMiddleware tries to redirect POST requests to add trailing slashes,
    but this fails because POST data can't be preserved during redirect.
    
    This middleware intercepts the redirect response and prevents it for API routes,
    allowing DRF router to handle URL matching without redirects.
    """
    
    def process_response(self, request, response):
        # If CommonMiddleware tried to redirect a POST/PUT/PATCH/DELETE for an API route,
        # prevent the redirect
        if request.path.startswith('/api/'):
            if response.status_code in (301, 302) and request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
                location = response.get('Location', '')
                # Check if it's a trailing slash redirect
                if location and location.endswith('/') and not request.path.endswith('/'):
                    # Prevent the redirect - try to resolve the URL with trailing slash
                    # If it exists, return a helpful error message
                    # The frontend should add trailing slashes, but this prevents the redirect error
                    from django.urls import resolve
                    try:
                        # Try to resolve with trailing slash to confirm it exists
                        resolve(request.path + '/')
                        # URL exists with trailing slash - return helpful error
                        return HttpResponse(
                            f'{{"detail": "API endpoint requires trailing slash for {request.method}. Use: {request.path}/"}}',
                            status=400,
                            content_type='application/json'
                        )
                    except:
                        # URL doesn't exist at all
                        return HttpResponse(
                            f'{{"detail": "API endpoint not found: {request.path}"}}',
                            status=404,
                            content_type='application/json'
                        )
        return response

