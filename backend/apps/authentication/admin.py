"""
Django admin configuration for authentication app
Includes CSV import/export functionality
"""
from django.contrib import admin
from django.urls import path, reverse
from django.shortcuts import redirect, render
from django.contrib import messages
from django.utils.html import format_html
from import_export.admin import ImportExportModelAdmin
from .models import User, RiderAccount, UserSession, BlackListedToken
from .resources import UserResource, RiderAccountResource, UserSessionResource
from .forms import UserCreationForm
from .token_utils import get_token_for_user


@admin.register(User)
class UserAdmin(ImportExportModelAdmin):
    """Admin interface for User model"""
    resource_class = UserResource
    
    list_display = [
        'id',
        'email',
        'username',
        'employee_id',
        'full_name',
        'role',
        'is_active',
        'is_staff',
        'is_superuser',
        'is_ops_team',
        'is_deliveryq',
        'pia_access',
        'is_api_user',
        'token_never_expires',
        'auth_source',
        'created_at',
    ]
    
    list_filter = [
        'is_active',
        'is_staff',
        'is_superuser',
        'is_ops_team',
        'is_deliveryq',
        'pia_access',
        'is_api_user',
        'token_never_expires',
        'tokens_revoked',
        'role',
        'auth_source',
        ('created_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'email',
        'username',
        'employee_id',
        'full_name',
    ]
    
    fieldsets = (
        ('Authentication', {
            'fields': ('email', 'username', 'password')
        }),
        ('Personal Information', {
            'fields': ('full_name', 'employee_id')
        }),
        ('Permissions', {
            'fields': (
                'is_active', 'is_staff', 'is_superuser',
                'is_ops_team', 'is_deliveryq', 'pia_access', 'role'
            )
        }),
        ('API User Settings', {
            'fields': ('is_api_user', 'token_never_expires'),
            'description': 'API users are for webhook/system access ONLY. They authenticate via API keys and CANNOT login via the login endpoint. Token never expires allows infinite token lifetime for regular users (not applicable to API users).'
        }),
        ('JWT Tokens', {
            'fields': ('generate_token_button', 'revoke_tokens_button', 'access_token', 'refresh_token', 'tokens_revoked', 'tokens_revoked_at'),
            'description': 'Generate JWT tokens for this user. Tokens will respect the "Token never expires" setting if enabled. Use "Revoke Tokens" if tokens are leaked.'
        }),
        ('Authentication Source', {
            'fields': ('auth_source',)
        }),
        ('Timestamps', {
            'fields': ('last_login', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at', 'last_login', 'generate_token_button', 'revoke_tokens_button', 'tokens_revoked_at')
    
    add_form = UserCreationForm
    
    actions = ['generate_tokens_action']
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
        ('Optional Information', {
            'classes': ('wide',),
            'fields': ('full_name', 'employee_id', 'role'),
        }),
        ('Permissions', {
            'classes': ('wide',),
            'fields': ('is_active', 'is_staff', 'is_superuser', 'is_ops_team', 'is_deliveryq', 'pia_access'),
        }),
        ('API User Settings', {
            'classes': ('wide',),
            'fields': ('is_api_user', 'token_never_expires'),
            'description': '⚠️ API users are for webhook/system access ONLY. They authenticate via API keys and CANNOT login via the login endpoint.'
        }),
    )
    
    def get_fieldsets(self, request, obj=None):
        if not obj:
            return self.add_fieldsets
        return super().get_fieldsets(request, obj)
    
    def get_form(self, request, obj=None, **kwargs):
        defaults = {}
        if obj is None:
            defaults['form'] = self.add_form
        defaults.update(kwargs)
        return super().get_form(request, obj, **defaults)


    def generate_token_button(self, obj):
        """Display button to generate tokens inline"""
        if not obj or not obj.pk:
            return "Save user first to generate tokens"
        
        url = reverse('admin:generate_user_token_inline', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}" style="background-color: #417690; color: white; padding: 8px 12px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">Generate JWT Tokens</a>',
            url
        )
    generate_token_button.short_description = "Actions"
    
    def revoke_tokens_button(self, obj):
        """Display button to revoke tokens"""
        if not obj or not obj.pk:
            return "N/A"
        
        if obj.tokens_revoked:
            return format_html(
                '<span style="color: #d32f2f; font-weight: bold;">⚠️ Tokens Revoked</span>'
            )
        
        url = reverse('admin:revoke_user_tokens', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}" style="background-color: #d32f2f; color: white; padding: 8px 12px; text-decoration: none; border-radius: 4px; display: inline-block;" onclick="return confirm(\'Are you sure you want to revoke all tokens for this user? This will invalidate all existing tokens.\');">Revoke Tokens</a>',
            url
        )
    revoke_tokens_button.short_description = "Token Security"
    
    def generate_tokens_action(self, request, queryset):
        """Admin action to generate tokens for selected users"""
        tokens_generated = []
        for user in queryset:
            try:
                tokens = get_token_for_user(user)
                tokens_generated.append({
                    'user': user.email,
                    'access_token': tokens['access'],
                    'refresh_token': tokens['refresh'],
                })
                self.message_user(
                    request,
                    f"Tokens generated for {user.email}. Access token: {tokens['access'][:20]}...",
                    level=messages.SUCCESS
                )
            except Exception as e:
                self.message_user(
                    request,
                    f"Failed to generate tokens for {user.email}: {str(e)}",
                    level=messages.ERROR
                )
        
        if tokens_generated:
            request.session['generated_tokens'] = tokens_generated
            return redirect('admin:authentication_user_changelist')
    
    generate_tokens_action.short_description = "Generate JWT tokens for selected users"
    
    def get_urls(self):
        """Add custom URLs for token generation and revocation"""
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:user_id>/generate-token-inline/',
                self.admin_site.admin_view(self.generate_token_inline),
                name='generate_user_token_inline',
            ),
            path(
                '<int:user_id>/revoke-tokens/',
                self.admin_site.admin_view(self.revoke_tokens),
                name='revoke_user_tokens',
            ),
        ]
        return custom_urls + urls
    
    def generate_token_inline(self, request, user_id):
        """Generate tokens and redirect back to user edit page with tokens filled"""
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            messages.error(request, "User not found.")
            return redirect('admin:authentication_user_changelist')
        
        try:
            tokens = get_token_for_user(user)
            
            # Blacklist old tokens if they exist
            if user.access_token:
                BlackListedToken.objects.get_or_create(
                    token=user.access_token,
                    user=user,
                    defaults={'reason': 'revoked'}
                )
            if user.refresh_token:
                BlackListedToken.objects.get_or_create(
                    token=user.refresh_token,
                    user=user,
                    defaults={'reason': 'revoked'}
                )
            
            # Store new tokens in user model
            user.access_token = tokens['access']
            user.refresh_token = tokens['refresh']
            # Don't reset tokens_revoked - let admin decide if user should be un-revoked
            # If tokens_revoked is True, new tokens will still be blocked by the flag
            user.save(update_fields=['access_token', 'refresh_token'])
            
            messages.success(
                request,
                f"JWT tokens generated successfully for {user.email}! Tokens are now displayed in the form below."
            )
        except Exception as e:
            messages.error(request, f"Failed to generate tokens: {str(e)}")
        
        return redirect('admin:authentication_user_change', user_id)
    
    def revoke_tokens(self, request, user_id):
        """Revoke all tokens for a user - blacklists stored tokens and sets revocation flag"""
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            messages.error(request, "User not found.")
            return redirect('admin:authentication_user_changelist')
        
        from django.utils import timezone
        from .models import BlackListedToken
        
        # Blacklist stored tokens if they exist
        tokens_blacklisted = 0
        if user.access_token:
            BlackListedToken.objects.get_or_create(
                token=user.access_token,
                user=user,
                defaults={'reason': 'revoked'}
            )
            tokens_blacklisted += 1
        
        if user.refresh_token:
            BlackListedToken.objects.get_or_create(
                token=user.refresh_token,
                user=user,
                defaults={'reason': 'revoked'}
            )
            tokens_blacklisted += 1
        
        # Set revocation flag (this will block all future tokens until reset)
        user.tokens_revoked = True
        user.tokens_revoked_at = timezone.now()
        user.save(update_fields=['tokens_revoked', 'tokens_revoked_at'])
        
        messages.warning(
            request,
            f"⚠️ All tokens for {user.email} have been revoked. "
            f"{tokens_blacklisted} stored token(s) blacklisted. "
            f"Existing tokens will be rejected."
        )
        
        return redirect('admin:authentication_user_change', user_id)


@admin.register(BlackListedToken)
class BlackListedTokenAdmin(admin.ModelAdmin):
    """Admin interface for BlackListedToken model"""
    
    list_display = [
        'id', 'user', 'reason', 'timestamp',
    ]
    
    list_filter = [
        'reason', ('timestamp', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'user__email', 'user__username', 'token',
    ]
    
    readonly_fields = ('timestamp',)
    
    fieldsets = (
        ('Token Information', {
            'fields': ('user', 'token', 'reason', 'timestamp')
        }),
    )
    
    def has_add_permission(self, request):
        # Don't allow manual addition - tokens are blacklisted via logout/revocation
        return False


@admin.register(RiderAccount)
class RiderAccountAdmin(ImportExportModelAdmin):
    """Admin interface for RiderAccount model"""
    resource_class = RiderAccountResource
    
    list_display = [
        'rider_id',
        'full_name',
        'email',
        'rider_type',
        'is_active',
        'is_approved',
        'is_rider',
        'is_super_user',
        'role',
        'pops_rider_id',
        'synced_to_pops',
        'created_at',
    ]
    
    list_filter = [
        'rider_type',
        'is_active',
        'is_approved',
        'is_rider',
        'is_super_user',
        'role',
        'synced_to_pops',
        ('created_at', admin.DateFieldListFilter),
        ('last_login_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'rider_id',
        'full_name',
        'email',
    ]
    
    fieldsets = (
        ('Rider Information', {
            'fields': ('rider_id', 'full_name', 'email', 'rider_type')
        }),
        ('Status', {
            'fields': ('is_active', 'is_approved', 'is_rider', 'is_super_user', 'role')
        }),
        ('POPS Integration', {
            'fields': ('pops_rider_id', 'synced_to_pops', 'pops_sync_error')
        }),
        ('Timestamps', {
            'fields': ('last_login_at', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at', 'last_login_at')
    
    actions = ['approve_riders', 'reject_riders']
    
    def approve_riders(self, request, queryset):
        """Approve selected riders"""
        count = queryset.update(is_approved=True, is_active=True)
        self.message_user(request, f'{count} riders approved successfully.')
    approve_riders.short_description = "Approve selected riders"
    
    def reject_riders(self, request, queryset):
        """Reject selected riders"""
        count = queryset.update(is_approved=False, is_active=False)
        self.message_user(request, f'{count} riders rejected.')
    reject_riders.short_description = "Reject selected riders"


@admin.register(UserSession)
class UserSessionAdmin(ImportExportModelAdmin):
    """Admin interface for UserSession model"""
    resource_class = UserSessionResource
    
    list_display = [
        'id',
        'user',
        'expires_at',
        'is_expired',
        'created_at',
    ]
    
    list_filter = [
        ('expires_at', admin.DateFieldListFilter),
        ('created_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'id',
        'user__email',
        'user__username',
    ]
    
    readonly_fields = ('id', 'created_at')
    
    def is_expired(self, obj):
        """Check if session is expired"""
        return obj.is_expired()
    is_expired.boolean = True
    is_expired.short_description = 'Expired'
