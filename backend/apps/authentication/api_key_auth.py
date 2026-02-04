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
        api_keys_config = getattr(settings, 'RIDER_PRO_API_KEYS', {})
        
        # Find matching API key and validate
        api_key_source = None
        client_config = None
        
        if isinstance(api_keys_config, dict):
            for source, config in api_keys_config.items():
                if isinstance(config, dict):
                    # New format: {"source": {"key": "...", "callback_url": "...", "active": True}}
                    if config.get("key") == api_key and config.get("active", True):
                        api_key_source = source
                        client_config = config
                        break
        
        if not client_config:
            logger.warning(f"Invalid API key attempted: {api_key[:10]}...")
            raise exceptions.AuthenticationFailed('Invalid API key')
        
        # Check if the client is active
        if not client_config.get("active", True):
            logger.warning(f"Inactive API key attempted: {api_key_source}")
            raise exceptions.AuthenticationFailed('API key is inactive')
        
        # Log the source if identified
        if api_key_source:
            logger.info(f"API key authenticated from source: {api_key_source}")
        
        # Get or create a system API user for webhook requests
        # API users are system users that authenticate via API keys only
        # They cannot login via the normal login endpoint
        from .models import User
        api_user, created = User.objects.get_or_create(
            email='api@riderpro.local',
            defaults={
                'username': 'api_user',
                'full_name': f'API User ({api_key_source})',
                'role': 'admin',
                'is_active': True,
                'is_staff': False,  # API users don't need staff access
                'is_superuser': False,
                'auth_source': 'webhook',
                'is_api_user': True,  # Mark as API user (webhook only, no login)
                'token_never_expires': False,  # API users don't use JWT tokens
            }
        )
        
        # Update existing API user if needed
        if not created:
            api_user.is_api_user = True
            api_user.is_staff = False  # Ensure API users don't have staff access
            api_user.auth_source = 'webhook'
            if api_key_source:
                api_user.full_name = f'API User ({api_key_source})'
            api_user.save(update_fields=['is_api_user', 'is_staff', 'auth_source', 'full_name'])
        
        if created:
            logger.info(f"Created API user for webhook authentication from {api_key_source}")
        
        # Store the API key source and client config in the request for potential use in views
        request.api_key_source = api_key_source
        request.client_config = client_config
        
        return (api_user, None)

