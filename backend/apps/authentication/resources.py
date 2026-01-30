"""
Resources for CSV import/export in authentication app
"""
from import_export import resources
from .models import User, RiderAccount, UserSession


class UserResource(resources.ModelResource):
    """Resource for User model CSV import/export"""
    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'employee_id', 'full_name',
            'role', 'is_active', 'is_staff', 'is_superuser', 'is_ops_team',
            'is_deliveryq', 'pia_access', 'auth_source', 'created_at', 'updated_at'
        )
        export_order = (
            'id', 'email', 'username', 'employee_id', 'full_name',
            'role', 'is_active', 'is_staff', 'is_superuser', 'is_ops_team',
            'is_deliveryq', 'pia_access', 'auth_source', 'created_at', 'updated_at'
        )


class RiderAccountResource(resources.ModelResource):
    """Resource for RiderAccount model CSV import/export"""
    class Meta:
        model = RiderAccount
        fields = (
            'rider_id', 'full_name', 'email', 'rider_type',
            'is_active', 'is_approved', 'is_rider', 'is_super_user',
            'role', 'pops_rider_id', 'synced_to_pops', 'pops_sync_error',
            'last_login_at', 'created_at', 'updated_at'
        )
        export_order = (
            'rider_id', 'full_name', 'email', 'rider_type',
            'is_active', 'is_approved', 'is_rider', 'is_super_user',
            'role', 'pops_rider_id', 'synced_to_pops', 'pops_sync_error',
            'last_login_at', 'created_at', 'updated_at'
        )


class UserSessionResource(resources.ModelResource):
    """Resource for UserSession model CSV import/export"""
    class Meta:
        model = UserSession
        fields = ('id', 'user__email', 'expires_at', 'created_at')
        export_order = ('id', 'user__email', 'expires_at', 'created_at')

