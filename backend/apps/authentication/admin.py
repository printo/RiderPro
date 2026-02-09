"""
Django admin configuration for authentication app
Includes CSV import/export functionality
"""
import logging
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

logger = logging.getLogger(__name__)


@admin.register(User)
class UserAdmin(ImportExportModelAdmin):
    """Admin interface for User model"""
    resource_class = UserResource
    
    list_display = [
        'id',
        'username',
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
        'username',
        'full_name',
    ]
    
    fieldsets = (
        ('Authentication', {
            'fields': ('username', 'password'),
            'description': 'Username is the email value from estimator DB (employeeId). This combines Authentication and Personal information.'
        }),
        ('Personal Information', {
            'fields': ('full_name',)
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
            'fields': ('username', 'password1', 'password2'),
            'description': 'Username is the email value from estimator DB (employeeId).'
        }),
        ('Optional Information', {
            'classes': ('wide',),
            'fields': ('full_name', 'role'),
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
                    'user': user.username,
                    'access_token': tokens['access'],
                    'refresh_token': tokens['refresh'],
                })
                self.message_user(
                    request,
                    f"Tokens generated for {user.username}. Access token: {tokens['access'][:20]}...",
                    level=messages.SUCCESS
                )
            except Exception as e:
                self.message_user(
                    request,
                    f"Failed to generate tokens for {user.username}: {str(e)}",
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
                f"JWT tokens generated successfully for {user.username}! Tokens are now displayed in the form below."
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
            f"⚠️ All tokens for {user.username} have been revoked. "
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
        'user__username', 'token',
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
    change_list_template = 'admin/authentication/rideraccount/change_list.html'
    
    list_display = [
        'rider_id',
        'full_name',
        'email',
        'rider_type',
        'is_active',
        'is_approved',
        'is_rider',
        'pops_rider_id',
        'synced_to_pops',
        'created_at',
    ]
    
    list_filter = [
        'rider_type',
        'is_active',
        'is_approved',
        'is_rider',
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
            'fields': ('is_active', 'is_approved', 'is_rider')
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
    
    actions = ['approve_riders', 'reject_riders', 'fetch_riders_from_pia']
    
    def get_actions(self, request):
        """Ensure actions are available and visible even with 0 records"""
        actions = super().get_actions(request)
        # Explicitly ensure all actions are included
        # This ensures actions show even when there are 0 records
        actions['approve_riders'] = (
            self.approve_riders,
            'approve_riders',
            self.approve_riders.short_description
        )
        actions['reject_riders'] = (
            self.reject_riders,
            'reject_riders',
            self.reject_riders.short_description
        )
        actions['fetch_riders_from_pia'] = (
            self.fetch_riders_from_pia,
            'fetch_riders_from_pia',
            self.fetch_riders_from_pia.short_description
        )
        return actions
    
    def get_urls(self):
        """Add custom URL for fetching riders"""
        urls = super().get_urls()
        custom_urls = [
            path(
                'fetch-riders-from-pia/',
                self.admin_site.admin_view(self.fetch_riders_from_pia_view),
                name='authentication_rideraccount_fetch_riders',
            ),
        ]
        return custom_urls + urls
    
    def changelist_view(self, request, extra_context=None):
        """Override to add custom button and ensure template is used"""
        extra_context = extra_context or {}
        # Add custom button URL
        extra_context['fetch_riders_url'] = reverse('admin:authentication_rideraccount_fetch_riders')
        # Explicitly set template to ensure it's used
        response = super().changelist_view(request, extra_context)
        # Debug: log if template is being used
        if hasattr(response, 'template_name'):
            logger.debug(f"Using template: {response.template_name}")
        return response
    
    def fetch_riders_from_pia_view(self, request):
        """Custom admin view to fetch riders from PIA"""
        from django.conf import settings
        import requests
        from .models import RiderAccount
        
        if request.method != 'POST':
            # Show confirmation page
            return render(request, 'admin/authentication/rideraccount/fetch_riders_confirm.html', {
                'title': 'Fetch Riders from PIA',
                'opts': self.model._meta,
                'has_view_permission': self.has_view_permission(request),
            })
        
        # Process the fetch
        success_count = 0
        error_count = 0
        errors = []
        
        # Get POPS API token from settings
        pops_api_url = getattr(settings, 'POPS_API_BASE_URL', 'http://localhost:8002/api/v1')
        access_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None)
        
        if not access_token:
            messages.error(request, 'Error: RIDER_PRO_SERVICE_TOKEN not configured in settings')
            return redirect('admin:authentication_rideraccount_changelist')
        
        # Fetch all riders from POPS API
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            # Try to fetch riders from POPS - use master/riders endpoint
            riders_url = f"{pops_api_url.rstrip('/')}/master/riders/" if pops_api_url else None
            
            if riders_url:
                response = requests.get(riders_url, headers=headers, timeout=30)
                if response.status_code == 200:
                    riders_data = response.json()
                    riders_list = riders_data if isinstance(riders_data, list) else riders_data.get('results', [])
                    
                    for rider_data in riders_list:
                        try:
                            rider_id = rider_data.get('rider_id') or str(rider_data.get('id', ''))
                            if not rider_id:
                                continue
                            
                            # Map POPS tags to rider_type
                            tags = rider_data.get('tags', '').lower()
                            rider_type = 'bike'  # default
                            if 'milkround' in tags:
                                rider_type = 'auto'
                            elif 'printo-bike' in tags or 'bike' in tags:
                                rider_type = 'bike'
                            elif 'hyperlocal' in tags:
                                rider_type = 'hyperlocal'
                            elif 'goods-auto' in tags or 'auto' in tags:
                                rider_type = 'auto'
                            elif '3pl' in tags:
                                rider_type = '3pl'
                            
                            pops_rider_id = rider_data.get('id')
                            rider_name = rider_data.get('name', '')
                            email = rider_data.get('email') or f"{rider_id}@rider.local"
                            
                            rider_account, created = RiderAccount.objects.get_or_create(
                                rider_id=rider_id,
                                defaults={
                                    'full_name': rider_name,
                                    'email': email,
                                    'rider_type': rider_type,
                                    'pops_rider_id': pops_rider_id,
                                    'is_active': True,
                                    'is_approved': True,
                                    'is_rider': True,
                                    'synced_to_pops': True,
                                }
                            )
                            
                            if not created:
                                # Update existing rider
                                rider_account.full_name = rider_name
                                rider_account.email = email
                                rider_account.rider_type = rider_type
                                rider_account.pops_rider_id = pops_rider_id
                                rider_account.synced_to_pops = True
                                rider_account.pops_sync_error = None
                                rider_account.save()
                            
                            success_count += 1
                        except Exception as e:
                            error_count += 1
                            errors.append(f"Rider {rider_data.get('rider_id', 'N/A')}: {str(e)}")
                else:
                    messages.error(request, f'Failed to fetch riders from PIA: HTTP {response.status_code}. Please check POPS API endpoint.')
                    return redirect('admin:authentication_rideraccount_changelist')
            else:
                messages.error(request, 'POPS_API_BASE_URL not configured. Cannot fetch riders.')
                return redirect('admin:authentication_rideraccount_changelist')
        except requests.exceptions.RequestException as e:
            messages.error(request, f'Error fetching riders from PIA: {str(e)}')
            return redirect('admin:authentication_rideraccount_changelist')
        except Exception as e:
            messages.error(request, f'An unexpected error occurred: {str(e)}')
            return redirect('admin:authentication_rideraccount_changelist')
        
        # Show results
        if success_count > 0:
            messages.success(request, f'Successfully fetched {success_count} rider(s) from PIA.')
        if error_count > 0:
            messages.warning(request, f'Failed to process {error_count} rider(s).')
            for err in errors[:10]:  # Show first 10 errors
                messages.error(request, err)
        
        return redirect('admin:authentication_rideraccount_changelist')
    
    def approve_riders(self, request, queryset):
        """Approve selected riders. If rider doesn't exist in PIA table, fetch from PIA first."""
        from django.conf import settings
        from utils.pops_client import pops_client
        
        access_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None)
        success_count = 0
        fetched_count = 0
        
        for rider_account in queryset:
            # Check if rider exists in PIA and sync data if not already synced
            if not rider_account.pops_rider_id and access_token:
                try:
                    # Try to fetch rider from PIA
                    pops_rider = pops_client.fetch_rider_by_id(rider_account.rider_id, access_token)
                    if pops_rider:
                        # Update rider account with PIA data
                        pops_rider_id = pops_rider.get('id')
                        rider_name = pops_rider.get('name', rider_account.full_name)
                        
                        # Map POPS tags to rider_type
                        tags = pops_rider.get('tags', '').lower()
                        rider_type = rider_account.rider_type  # Keep existing if no match
                        if 'milkround' in tags or 'goods-auto' in tags or 'auto' in tags:
                            rider_type = 'auto'
                        elif 'printo-bike' in tags or 'bike' in tags:
                            rider_type = 'bike'
                        elif 'hyperlocal' in tags:
                            rider_type = 'hyperlocal'
                        elif '3pl' in tags:
                            rider_type = '3pl'
                        
                        rider_account.pops_rider_id = pops_rider_id
                        rider_account.full_name = rider_name
                        rider_account.rider_type = rider_type
                        rider_account.synced_to_pops = True
                        rider_account.pops_sync_error = None
                        fetched_count += 1
                except Exception as e:
                    # Log error but don't fail approval
                    logger.warning(f"Could not fetch rider {rider_account.rider_id} from PIA: {e}")
                    rider_account.pops_sync_error = str(e)
            
            # Approve the rider
            rider_account.is_approved = True
            rider_account.is_active = True
            rider_account.save()
            success_count += 1
        
        message = f'{success_count} rider(s) approved successfully.'
        if fetched_count > 0:
            message += f' {fetched_count} rider(s) were fetched from PIA.'
        self.message_user(request, message)
    approve_riders.short_description = "Approve selected riders"
    
    def reject_riders(self, request, queryset):
        """Reject selected riders"""
        count = queryset.update(is_approved=False, is_active=False)
        self.message_user(request, f'{count} riders rejected.')
    reject_riders.short_description = "Reject selected riders"
    
    def fetch_riders_from_pia(self, request, queryset):
        """Fetch riders from PIA - redirects to custom view (kept for backward compatibility)"""
        # Redirect to the custom view instead of processing here
        return redirect('admin:authentication_rideraccount_fetch_riders')
    fetch_riders_from_pia.short_description = "Fetch riders from PIA"
    fetch_riders_from_pia.allow_empty = True  # Allow action without selection
    fetch_riders_from_pia.allow_empty = True  # Allow action without selection


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
        'user__username',
    ]
    
    readonly_fields = ('id', 'created_at')
    
    def is_expired(self, obj):
        """Check if session is expired"""
        return obj.is_expired()
    is_expired.boolean = True
    is_expired.short_description = 'Expired'
