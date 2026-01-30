"""
Admin views for shipments
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings

logger = __import__('logging').getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def access_tokens(request):
    """
    Get access tokens for external integration
    Matches /api/admin/access-tokens from Node.js backend
    """
    try:
        # Get API keys from settings or environment
        access_token_1 = getattr(settings, 'ACCESS_TOKEN_1', '')
        access_token_2 = getattr(settings, 'ACCESS_TOKEN_2', '')
        
        def get_masked_token(token):
            if not token or len(token) < 8:
                return '****'
            return f"{token[:4]}****{token[-4:]}"
        
        access_tokens = [
            {
                'id': 'access-token-1',
                'name': 'Access Token 1',
                'token': access_token_1,
                'masked': get_masked_token(access_token_1),
                'description': 'Primary access token for external system integration',
                'created': '2024-01-01T00:00:00Z',
                'status': 'active'
            },
            {
                'id': 'access-token-2',
                'name': 'Access Token 2',
                'token': access_token_2,
                'masked': get_masked_token(access_token_2),
                'description': 'Secondary access token for external system integration',
                'created': '2024-01-01T00:00:00Z',
                'status': 'active'
            }
        ]
        
        return Response({
            'success': True,
            'accessTokens': access_tokens
        })
    except Exception as e:
        logger.error(f"Failed to retrieve access tokens: {e}")
        return Response(
            {'success': False, 'message': 'Failed to retrieve access tokens'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )






