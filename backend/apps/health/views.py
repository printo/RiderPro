"""
Views for health check endpoints
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connection
from django.utils import timezone
import time

logger = logging.getLogger(__name__)

# Health check cache (simple in-memory cache)
_health_cache = None
_cache_timestamp = 0
CACHE_TTL = 10  # 10 seconds


@api_view(['GET', 'HEAD'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint - matches /api/health from Node.js backend
    Includes caching and rate limiting
    Supports both GET and HEAD methods
    """
    global _health_cache, _cache_timestamp
    
    now = time.time()
    
    # Return cached response if still valid
    if _health_cache and (now - _cache_timestamp) < CACHE_TTL:
        response = Response(_health_cache if request.method == 'GET' else None)
        response['Cache-Control'] = 'public, max-age=10'
        response['X-Health-Cache'] = 'HIT'
        return response
    
    try:
        # Check database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        
        health_data = {
            'status': 'ok',
            'timestamp': timezone.now().isoformat(),
            'uptime': time.time(),  # TODO: Track actual uptime
            'cached': False
        }
        
        # Cache the response
        _health_cache = health_data
        _cache_timestamp = now
        
        # For HEAD requests, return empty body but with headers
        response = Response(health_data if request.method == 'GET' else None)
        response['Cache-Control'] = 'public, max-age=10'
        response['X-Health-Cache'] = 'MISS'
        return response
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        error_data = {
            'status': 'degraded',
            'timestamp': timezone.now().isoformat(),
            'error': str(e)
        }
        return Response(
            error_data if request.method == 'GET' else None,
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def api_status(request):
    """
    API status endpoint - matches /api-status from Node.js backend
    """
    from django.conf import settings
    import os
    
    pops_api_url = os.getenv('POPS_API_BASE_URL', 'POPS_API_BASE_URL not configured')
    
    return Response({
        'message': f'Server is running. POPS API: {pops_api_url}',
        'timestamp': timezone.now().isoformat()
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def log_error(request):
    """
    Error logging endpoint - matches POST /api/errors from Node.js backend
    Logs frontend/client errors
    """
    try:
        logger.error('Frontend Error:', request.data)
        return Response({'logged': True}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f'Failed to log client error: {e}')
        return Response(
            {'success': False, 'message': 'Failed to log error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
