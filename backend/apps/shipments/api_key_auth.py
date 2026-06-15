"""
API-key authentication for inbound integration webhooks (POPS/PIA).

Validates the `x-api-key` header (constant-time) against settings.RIDER_PRO_API_KEYS
— a dict of {source_name: {"key": ..., "callback_url": ..., "active": bool, ...}}.
On success it stamps `request.api_key_source` (used to route outbound callbacks and
to set `Shipment.api_source`). Returns None when no key is present so JWT auth can
still be attempted; raises AuthenticationFailed when a key is present but invalid.
"""
import hmac

from django.conf import settings
from rest_framework import authentication, exceptions


def get_api_key_configs() -> dict:
    """Return RIDER_PRO_API_KEYS normalized to {source: {key, callback_url, ...}}.

    The code keys integrations by a SOURCE NAME (used for `request.api_key_source`,
    `Shipment.api_source`, and outbound-callback routing), so the dict form is
    canonical. But the docs/example historically showed a list, which silently
    failed closed. Accept BOTH: a list entry's source is its `source`/`name`
    field, else a synthetic `source_<i>`. Fails closed to {} on anything else.
    """
    raw = getattr(settings, 'RIDER_PRO_API_KEYS', {}) or {}
    if isinstance(raw, dict):
        return {src: entry for src, entry in raw.items() if isinstance(entry, dict)}
    if isinstance(raw, list):
        normalized = {}
        for i, entry in enumerate(raw):
            if not isinstance(entry, dict):
                continue
            source = entry.get('source') or entry.get('name') or f'source_{i}'
            normalized[source] = entry
        return normalized
    return {}


class APIKeyPrincipal:
    """Lightweight authenticated principal representing an inbound integration."""

    def __init__(self, source: str):
        self.source = source
        self.is_authenticated = True
        self.is_active = True
        self.is_staff = False
        self.is_superuser = False
        self.pk = None
        self.id = None

    def __str__(self):
        return f"api-key:{self.source}"


class APIKeyAuthentication(authentication.BaseAuthentication):
    """DRF authenticator for the `x-api-key` header."""

    def authenticate(self, request):
        provided = request.META.get('HTTP_X_API_KEY')
        if not provided:
            # No API key — defer to the next authenticator (JWT/cookie).
            return None

        for source, entry in get_api_key_configs().items():
            key = entry.get('key') or ''
            # Constant-time compare to avoid timing oracles.
            if key and hmac.compare_digest(str(key), str(provided)):
                if not entry.get('active', True):
                    raise exceptions.AuthenticationFailed('API key is inactive.')
                request.api_key_source = source
                return (APIKeyPrincipal(source), None)

        # A key was supplied but matched no active entry → reject.
        raise exceptions.AuthenticationFailed('Invalid API key.')

    def authenticate_header(self, request):
        # Makes DRF return 401 (not 403) when auth is missing.
        return 'x-api-key'
