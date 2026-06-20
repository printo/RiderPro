"""
Authentication models for RiderPro
Supports local users, POPS users, and rider accounts
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom user manager - uses username as primary identifier"""
    
    def create_user(self, username, password=None, **extra_fields):
        """Create and save a regular user"""
        if not username:
            raise ValueError('The Username field must be set')
        # Username is the email value from estimator DB (employeeId)
        user = self.model(username=username, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, username, password=None, **extra_fields):
        """Create and save a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model supporting:
    - Local admin users (created in RiderPro)
    - POPS users (authenticated via POPS API)
    - Rider accounts (local riders without POPS login)
    
    Username is the primary identifier and contains the email value from estimator DB (employeeId).
    This combines Authentication and Personal information into a single field.
    """
    username = models.CharField(max_length=255, unique=True)
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
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['role']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.username

    @property
    def employee_id(self):
        """Alias for username to match employee_id usage in views"""
        return self.username

    def get_full_name(self):
        return self.full_name or self.username

    def get_short_name(self):
        """
        Short name used by Django admin and other UIs.
        Be defensive in case username is None in legacy rows.
        """
        username = self.username or ""
        return username.split("@")[0] if "@" in username else username


class Homebase(models.Model):
    """
    Homebase/Location Master from POPS
    Represents physical locations where riders are based
    """
    # POPS ID (for sync)
    pops_homebase_id = models.IntegerField(unique=True, null=True, blank=True, help_text='Homebase ID from POPS')
    
    # Basic Info (matching POPS structure)
    name = models.CharField(max_length=200)
    homebase_id = models.CharField(max_length=100, unique=True, help_text='Homebase identifier code')
    aggregator_id = models.CharField(max_length=200, blank=True, default='')
    
    # Address Details
    location = models.CharField(max_length=255, blank=True, default='')
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    pincode = models.CharField(max_length=10, null=True, blank=True)
    
    # Geolocation
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    
    # Operational
    is_active = models.BooleanField(default=True)
    capacity = models.IntegerField(null=True, blank=True, help_text='Maximum number of riders')
    
    # Sync tracking
    synced_from_pops = models.BooleanField(default=False)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'homebases'
        indexes = [
            models.Index(fields=['homebase_id']),
            models.Index(fields=['pops_homebase_id']),
            models.Index(fields=['is_active']),
        ]
        verbose_name = 'Homebase'
        verbose_name_plural = 'Homebases'
    
    def __str__(self):
        return f"{self.homebase_id} - {self.name}"


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
    
    # Homebase Assignment
    primary_homebase = models.ForeignKey(
        'Homebase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='primary_riders'
    )
    
    # Multiple homebases support
    homebases = models.ManyToManyField(
        'Homebase',
        through='RiderHomebaseAssignment',
        related_name='assigned_riders'
    )
    
    # Vehicle type (references VehicleType from vehicles app)
    vehicle_type = models.ForeignKey(
        'vehicles.VehicleType',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='riders'
    )
    
    # Legacy rider_type field for backward compatibility (deprecated)
    rider_type = models.CharField(
        max_length=50,
        choices=[
            ('bike', 'Bike'),
            ('auto', 'Auto'),
            ('3pl', '3PL'),
            ('hyperlocal', 'Hyperlocal'),
        ],
        default='bike',
        null=True,
        blank=True,
        help_text='Legacy field - use vehicle_type instead'
    )
    
    # Dispatch option (type of delivery - matches POPS dispatch_option)
    dispatch_option = models.CharField(
        max_length=50,
        choices=[
            ('printo-bike', 'Printo Bike'),
            ('milkround', 'Milkround Auto'),
            ('goods-auto', 'Goods Auto'),
            ('3PL', '3PL'),
        ],
        default='printo-bike',
        help_text='Type of delivery this rider handles (synced to POPS as tags)'
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_approved = models.BooleanField(default=False)  # Manager must approve
    is_rider = models.BooleanField(default=True)
    
    # POPS integration
    phone = models.CharField(max_length=20, blank=True, default='')
    archived_at = models.DateTimeField(null=True, blank=True)
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


class RiderHomebaseAssignment(models.Model):
    """
    Junction table for riders and homebases
    Supports multiple homebase records as per POPS architecture
    """
    rider = models.ForeignKey('RiderAccount', on_delete=models.CASCADE)
    homebase = models.ForeignKey('Homebase', on_delete=models.CASCADE)
    
    # Record association
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    # POPS-specific synchronization
    pops_rider_id = models.IntegerField(null=True, blank=True, help_text='Rider record ID in POPS for this homebase')
    synced_to_pops = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'rider_homebase_assignments'
        unique_together = [['rider', 'homebase']]
        indexes = [
            models.Index(fields=['rider', 'is_active']),
            models.Index(fields=['homebase', 'is_active']),
        ]
        verbose_name = 'Rider Homebase Assignment'
        verbose_name_plural = 'Rider Homebase Assignments'
    
    def __str__(self):
        return f"{self.rider.rider_id} @ {self.homebase.homebase_id}"


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
        return f"Session {self.id} for {self.user.username}"
    
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
        return f"Blacklisted token for {self.user.username} at {self.timestamp}"


class VehicleChangeRequest(models.Model):
    """
    A rider's request to change their assigned vehicle type. Mirrors the rider
    signup-approval flow: the rider raises a pending request, a manager approves
    it (which updates RiderAccount.vehicle_type) or rejects it. Keeps the vehicle
    — which drives mileage and fuel cost — governed, not freely rider-editable.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    id = models.AutoField(primary_key=True)
    rider = models.ForeignKey(
        'RiderAccount',
        on_delete=models.CASCADE,
        related_name='vehicle_change_requests'
    )
    current_vehicle_type = models.ForeignKey(
        'vehicles.VehicleType',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+'
    )
    requested_vehicle_type = models.ForeignKey(
        'vehicles.VehicleType',
        on_delete=models.CASCADE,
        related_name='change_requests'
    )
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.CharField(max_length=255, null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vehicle_change_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['rider', 'status']),
        ]

    def __str__(self):
        return f"VehicleChangeRequest {self.id} - rider {self.rider_id} ({self.status})"


class OtpChallenge(models.Model):
    """
    OTP challenges for passwordless rider authentication
    """
    phone = models.CharField(max_length=20, db_index=True)
    code_hash = models.CharField(max_length=255)
    purpose = models.CharField(max_length=50, default='rider_login')
    attempts = models.IntegerField(default=0)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    request_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'otp_challenges'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['phone', 'expires_at']),
        ]

    def __str__(self):
        return f"OtpChallenge for {self.phone} ({self.purpose})"
