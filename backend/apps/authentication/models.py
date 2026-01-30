"""
Authentication models for RiderPro
Supports local users, POPS users, and rider accounts
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom user manager"""
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user"""
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model supporting:
    - Local admin users (created in RiderPro)
    - POPS users (authenticated via POPS API)
    - Rider accounts (local riders without POPS login)
    """
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=255, unique=True, null=True, blank=True)
    employee_id = models.CharField(max_length=255, null=True, blank=True)
    full_name = models.CharField(max_length=255, blank=True)
    
    # Role and permissions
    role = models.CharField(
        max_length=50,
        choices=[
            ('admin', 'Admin'),
            ('manager', 'Manager'),
            ('driver', 'Driver'),
            ('viewer', 'Viewer'),
        ],
        default='viewer'
    )
    
    # Status flags
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    is_ops_team = models.BooleanField(default=False)
    is_deliveryq = models.BooleanField(default=False)
    pia_access = models.BooleanField(default=False)
    is_api_user = models.BooleanField(default=False)  # API user for webhook/system access
    token_never_expires = models.BooleanField(default=False)  # Infinite token lifetime
    
    # Token storage (for POPS JWT tokens)
    access_token = models.TextField(null=True, blank=True)
    refresh_token = models.TextField(null=True, blank=True)
    
    # Timestamps
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Authentication source
    auth_source = models.CharField(
        max_length=20,
        choices=[
            ('local', 'Local Database'),
            ('pops', 'POPS API'),
            ('rider', 'Rider Account'),
            ('webhook', 'Webhook'),
        ],
        default='local'
    )
    
    # Token revocation
    tokens_revoked = models.BooleanField(default=False)  # Revoke all tokens if leaked
    tokens_revoked_at = models.DateTimeField(null=True, blank=True)  # When tokens were revoked
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['role']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.email or self.username or str(self.id)
    
    def get_full_name(self):
        return self.full_name or self.email
    
    def get_short_name(self):
        return self.email.split('@')[0] if self.email else ''


class RiderAccount(models.Model):
    """
    Local rider accounts for riders who don't have POPS login
    Created from UI, requires manager approval
    Once approved, rider data is populated in POPS
    """
    rider_id = models.CharField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255)
    password_hash = models.CharField(max_length=255)  # bcrypt hash
    email = models.EmailField(null=True, blank=True)
    
    # Rider type (4 types: bike, auto, 3pl, hyperlocal)
    rider_type = models.CharField(
        max_length=50,
        choices=[
            ('bike', 'Bike'),
            ('auto', 'Auto'),
            ('3pl', '3PL'),
            ('hyperlocal', 'Hyperlocal'),
        ],
        default='bike'
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_approved = models.BooleanField(default=False)  # Manager must approve
    is_rider = models.BooleanField(default=True)
    is_super_user = models.BooleanField(default=False)
    
    # Role
    role = models.CharField(
        max_length=50,
        choices=[
            ('is_super_user', 'Super User'),
            ('is_rider', 'Rider'),
            ('is_driver', 'Driver'),
        ],
        default='is_driver'
    )
    
    # POPS integration
    pops_rider_id = models.IntegerField(null=True, blank=True)  # POPS rider ID after approval
    synced_to_pops = models.BooleanField(default=False)
    pops_sync_error = models.TextField(null=True, blank=True)
    
    # Timestamps
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'rider_accounts'
        indexes = [
            models.Index(fields=['rider_id']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.rider_id} - {self.full_name}"


class UserSession(models.Model):
    """
    User session management for JWT tokens
    Stores active sessions with access tokens
    """
    id = models.CharField(max_length=255, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    access_token = models.TextField()
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_sessions'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"Session {self.id} for {self.user.email}"
    
    def is_expired(self):
        return timezone.now() > self.expires_at


class BlackListedToken(models.Model):
    """
    Blacklisted JWT tokens for logout and revocation
    Follows the pattern used in printo_se_api and pops
    """
    token = models.CharField(max_length=500)
    user = models.ForeignKey(User, related_name="blacklisted_tokens", on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now=True)
    reason = models.CharField(
        max_length=50,
        choices=[
            ('logout', 'User Logout'),
            ('revoked', 'Admin Revocation'),
            ('security', 'Security Breach'),
        ],
        default='logout',
        null=True,
        blank=True
    )
    
    class Meta:
        unique_together = ("token", "user")
        db_table = 'blacklisted_tokens'
        indexes = [
            models.Index(fields=['user', 'token']),
            models.Index(fields=['timestamp']),
        ]
    
    def __str__(self):
        return f"Blacklisted token for {self.user.email} at {self.timestamp}"
