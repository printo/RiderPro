"""
Shared DRF permissions for the shipments app.
"""
from rest_framework.permissions import BasePermission


def is_manager_user(user) -> bool:
    """True for ops/admin/manager/staff/superuser — i.e. NOT a plain driver/rider."""
    return bool(
        user
        and getattr(user, 'is_authenticated', False)
        and (
            getattr(user, 'is_superuser', False)
            or getattr(user, 'is_staff', False)
            or getattr(user, 'is_ops_team', False)
            or getattr(user, 'role', None) in ('admin', 'manager')
        )
    )


class IsManagerUser(BasePermission):
    """Allow only managers/ops/admins — used to gate system/sync/callback endpoints
    that drivers must not reach (prevents IDOR via shipment-id lookups)."""

    message = 'Manager access required.'

    def has_permission(self, request, view):
        return is_manager_user(request.user)
