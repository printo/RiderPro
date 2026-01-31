"""
API Key Authentication for webhook endpoints
Allows external systems (like POPS) to authenticate using API keys
"""
import logging
from rest_framework import authentication, exceptions
from django.conf import settings

logger = logging.getLogger(__name__)


class APIKeyAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication class for API key-based authentication.
    Checks for API key in x-api-key header.
    """
    
    def authenticate(self, request):
        """
        Authenticate the request using API key from header.
        Returns (user, None) if valid, None if no key, or raises exception if invalid.
        """
        api_key = request.META.get('HTTP_X_API_KEY') or request.META.get('X-API-KEY')
        
        if not api_key:
            # No API key provided, let other authentication classes handle it
            return None
        
        # Get valid API keys from settings
        valid_api_keys = getattr(settings, 'RIDER_PRO_API_KEYS', [])
        
        # Also check environment variable
        import os
        env_api_key = os.getenv('RIDER_PRO_ACCESS_KEY')
        if env_api_key:
            valid_api_keys = list(valid_api_keys) + [env_api_key]
        
        if api_key not in valid_api_keys:
            logger.warning(f"Invalid API key attempted: {api_key[:10]}...")
            raise exceptions.AuthenticationFailed('Invalid API key')
        
        # Get or create a system API user for webhook requests
        # API users are system users that authenticate via API keys only
        # They cannot login via the normal login endpoint
        from .models import User
        api_user, created = User.objects.get_or_create(
            email='api@riderpro.local',
            defaults={
                'username': 'api_user',
                'full_name': 'API User (Webhook Only)',
                'role': 'admin',
                'is_active': True,
                'is_staff': False,  # API users don't need staff access
                'is_superuser': False,
                'auth_source': 'webhook',  # Changed from 'local' to 'webhook' - API users authenticate via API key/webhook
                'is_api_user': True,  # Mark as API user (webhook only, no login)
                'token_never_expires': False,  # API users don't use JWT tokens
            }
        )
        
        # Update existing API user if needed
        if not created:
            api_user.is_api_user = True
            api_user.is_staff = False  # Ensure API users don't have staff access
            api_user.auth_source = 'webhook'  # Update auth_source to 'webhook' if it was 'local'
            api_user.save(update_fields=['is_api_user', 'is_staff', 'auth_source'])
        
        if created:
            logger.info("Created API user for webhook authentication (webhook only, no login)")
        
        return (api_user, None)

