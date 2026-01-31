"""
Custom JWT Authentication that supports both Authorization header and cookies
Matches the pattern used in printo-nextjs, printose, etc.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.utils.translation import gettext_lazy as _


class CookieJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication that checks both Authorization header and cookies
    Supports 'access' cookie (matching frontend pattern)
    """
    
    def authenticate(self, request):
        # First try Authorization header (standard JWT)
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                try:
                    validated_token = self.get_validated_token(raw_token)
                    user = self.get_user(validated_token)
                    
                    # Check blacklist (logout/revocation)
                    token_str = str(validated_token)
                    from .models import BlackListedToken
                    if BlackListedToken.objects.filter(token=token_str, user=user).exists():
                        raise InvalidToken("Token has been blacklisted")
                    
                    # Check if tokens are revoked (admin-level revocation)
                    if hasattr(user, 'tokens_revoked') and user.tokens_revoked:
                        raise InvalidToken("Tokens have been revoked")
                    
                    return (user, validated_token)
                except (InvalidToken, TokenError):
                    pass  # Fall through to cookie check
        
        # If no Authorization header or it failed, check cookies
        access_token = request.COOKIES.get('access')
        if access_token:
            try:
                raw_token = access_token.encode('utf-8')
                validated_token = self.get_validated_token(raw_token)
                user = self.get_user(validated_token)
                
                # Check blacklist (logout/revocation)
                token_str = str(validated_token)
                from .models import BlackListedToken
                if BlackListedToken.objects.filter(token=token_str, user=user).exists():
                    raise InvalidToken("Token has been blacklisted")
                
                # Check if tokens are revoked (admin-level revocation)
                if hasattr(user, 'tokens_revoked') and user.tokens_revoked:
                    raise InvalidToken("Tokens have been revoked")
                
                return (user, validated_token)
            except (InvalidToken, TokenError):
                pass
        
        return None

