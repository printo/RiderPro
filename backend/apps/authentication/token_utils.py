"""
Token utilities for API users with infinite token lifetime
"""
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
from django.utils import timezone


def get_token_for_user(user):
    """
    Generate JWT tokens for a user.
    If user has token_never_expires=True, creates tokens with very long expiration.
    """
    refresh = RefreshToken.for_user(user)
    
    # If user has infinite token lifetime, set very long expiration
    if hasattr(user, 'token_never_expires') and user.token_never_expires:
        # Set expiration to 100 years (effectively infinite)
        from django.conf import settings
        from datetime import timedelta
        
        # Override token lifetime for this user
        refresh.set_exp(from_time=timezone.now(), lifetime=timedelta(days=36500))  # ~100 years
        access = refresh.access_token
        access.set_exp(from_time=timezone.now(), lifetime=timedelta(days=36500))
    else:
        access = refresh.access_token
    
    return {
        'access': str(access),
        'refresh': str(refresh),
    }

