"""
Shipment models for RiderPro
Integrates with POPS Order model
Includes route tracking models (RouteSession, RouteTracking)
"""
from django.db import models
from django.conf import settings


class Shipment(models.Model):
    """
    Shipment model - maps to POPS Order model
    Currently read-only from POPS, future read/write capability
    """
    # Primary identifier - auto-incrementing integer
    id = models.AutoField(primary_key=True)
    
    # Basic shipment info
    type = models.CharField(
        max_length=50,
        choices=[
            ('delivery', 'Delivery'),
            ('pickup', 'Pickup'),
        ],
        null=True,
        blank=True
    )
    customer_name = models.TextField()
    customer_mobile = models.TextField()
    address = models.JSONField(null=True, blank=True, help_text="Delivery address as JSON object")
    
    # GPS coordinates
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    # Delivery details
    cost = models.FloatField()
    delivery_time = models.DateTimeField()
    route_name = models.TextField()
    employee_id = models.CharField(max_length=255)  # Rider/driver ID
    
    # Status tracking
    status = models.CharField(
        max_length=50,
        choices=[
            ('Initiated', 'Initiated'),
            ('Assigned', 'Assigned'),
            ('In Transit', 'In Transit'),
            ('Delivered', 'Delivered'),
            ('Picked Up', 'Picked Up'),
            ('Returned', 'Returned'),
            ('Cancelled', 'Cancelled'),
        ],
        null=True,
        blank=True
    )
    
    # Additional details
    pickup_address = models.JSONField(null=True, blank=True, help_text="Pickup address as JSON object (from clickpost logic)")
    weight = models.FloatField(default=0)
    package_boxes = models.JSONField(null=True, blank=True)  # Store detailed package box information
    special_instructions = models.TextField(null=True, blank=True)
    actual_delivery_time = models.DateTimeField(null=True, blank=True)
    priority = models.CharField(max_length=20, default='medium')
    remarks = models.TextField(null=True, blank=True)
    
    # GPS tracking for route
    start_latitude = models.FloatField(null=True, blank=True)
    start_longitude = models.FloatField(null=True, blank=True)
    stop_latitude = models.FloatField(null=True, blank=True)
    stop_longitude = models.FloatField(null=True, blank=True)
    km_travelled = models.FloatField(default=0)
    
    # Sync tracking with POPS
    synced_to_external = models.BooleanField(default=False)
    last_sync_attempt = models.DateTimeField(null=True, blank=True)
    sync_error = models.TextField(null=True, blank=True)
    sync_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('synced', 'Synced'),
            ('failed', 'Failed'),
            ('needs_sync', 'Needs Sync'),
        ],
        default='pending'
    )
    sync_attempts = models.IntegerField(default=0)
    
    # Acknowledgment
    signature_url = models.TextField(null=True, blank=True)
    photo_url = models.TextField(null=True, blank=True)
    pdf_url = models.TextField(null=True, blank=True, help_text="URL to PDF document for signing")
    signed_pdf_url = models.TextField(null=True, blank=True, help_text="URL to signed PDF after recipient signs")
    acknowledgment_captured_at = models.DateTimeField(null=True, blank=True)
    acknowledgment_captured_by = models.CharField(max_length=255, null=True, blank=True)
    
    # Region for acknowledgment settings
    region = models.CharField(max_length=100, null=True, blank=True, help_text="Region/city for acknowledgment settings")
    
    # POPS integration
    pops_order_id = models.IntegerField(null=True, blank=True, db_index=True)  # POPS Order.id
    pops_shipment_uuid = models.CharField(max_length=255, null=True, blank=True)
    
    # API source tracking
    api_source = models.CharField(
        max_length=100, 
        null=True, 
        blank=True,
        help_text="Source of the API call that created this shipment (e.g., printo_api_key_2024, external_system_key_1)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'shipments'
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['created_at']),
            models.Index(fields=['synced_to_external', 'sync_status']),
            models.Index(fields=['status', 'type', 'route_name', 'created_at']),
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['pops_order_id']),
            models.Index(fields=['api_source']),  # Index for API source tracking
            models.Index(fields=['api_source', 'created_at']),  # Composite index for analytics
        ]
    
    def __str__(self):
        return f"Shipment {self.id} - {self.customer_name}"


class Acknowledgment(models.Model):
    """
    Acknowledgment records for shipments
    Stores signature and photo URLs
    """
    shipment = models.OneToOneField(
        Shipment,
        on_delete=models.CASCADE,
        related_name='acknowledgment',
        primary_key=True
    )
    signature_url = models.TextField(null=True, blank=True)
    photo_url = models.TextField(null=True, blank=True)
    acknowledgment_captured_at = models.DateTimeField(auto_now_add=True)
    acknowledgment_captured_by = models.CharField(max_length=255, null=True, blank=True)
    
    class Meta:
        db_table = 'acknowledgments'
    
    def __str__(self):
        return f"Acknowledgment for {self.shipment.id}"


class RouteSession(models.Model):
    """
    Route tracking session
    Tracks a rider's route from start to end
    """
    id = models.CharField(max_length=255, primary_key=True)
    employee_id = models.CharField(max_length=255, db_index=True)
    
    # Session timing
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    
    # Status
    status = models.CharField(
        max_length=50,
        choices=[
            ('active', 'Active'),
            ('completed', 'Completed'),
            ('paused', 'Paused'),
        ],
        default='active'
    )
    
    # GPS coordinates
    start_latitude = models.FloatField()
    start_longitude = models.FloatField()
    end_latitude = models.FloatField(null=True, blank=True)
    end_longitude = models.FloatField(null=True, blank=True)
    
    # Route metrics
    total_distance = models.FloatField(default=0)  # in km
    total_time = models.IntegerField(default=0)  # in seconds
    fuel_consumed = models.FloatField(default=0)
    fuel_cost = models.FloatField(default=0)
    average_speed = models.FloatField(default=0)  # km/h
    shipments_completed = models.IntegerField(default=0)
    
    # Optional shipment reference
    shipment_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'route_sessions'
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['start_time']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Route Session {self.id} - {self.employee_id}"


class RouteTracking(models.Model):
    """
    GPS coordinates tracking for route sessions
    Records GPS points along a route
    """
    id = models.AutoField(primary_key=True)
    session = models.ForeignKey(
        RouteSession,
        on_delete=models.CASCADE,
        related_name='tracking_points',
        db_column='session_id'
    )
    employee_id = models.CharField(max_length=255, db_index=True)
    
    # GPS coordinates
    latitude = models.FloatField()
    longitude = models.FloatField()
    timestamp = models.DateTimeField()
    date = models.DateField(auto_now_add=True)
    
    # GPS metadata
    accuracy = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True)
    
    # Event type
    event_type = models.CharField(
        max_length=50,
        choices=[
            ('gps', 'GPS Point'),
            ('pickup', 'Pickup'),
            ('delivery', 'Delivery'),
        ],
        default='gps'
    )
    
    # Optional shipment reference
    shipment_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Fuel calculation (for analytics)
    fuel_efficiency = models.FloatField(default=15.0)  # km/liter
    fuel_price = models.FloatField(default=1.5)  # per liter
    
    class Meta:
        db_table = 'route_tracking'
        indexes = [
            models.Index(fields=['session']),
            models.Index(fields=['employee_id']),
            models.Index(fields=['date']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['employee_id', 'date']),
        ]
    
    def __str__(self):
        return f"GPS Point {self.id} - Session {self.session_id}"


class OrderEvent(models.Model):
    """
    Event-driven order management system
    Tracks all status changes and events for shipments
    """
    EVENT_TYPES = [
        ('status_change', 'Status Change'),
        ('pickup', 'Pickup'),
        ('delivery', 'Delivery'),
        ('assignment', 'Assignment'),
        ('route_start', 'Route Start'),
        ('route_end', 'Route End'),
        ('acknowledgment', 'Acknowledgment'),
        ('sync', 'Sync Event'),
        ('error', 'Error'),
    ]
    
    id = models.AutoField(primary_key=True)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='events')
    
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    old_status = models.CharField(max_length=50, null=True, blank=True)
    new_status = models.CharField(max_length=50, null=True, blank=True)
    
    # Event metadata
    metadata = models.JSONField(null=True, blank=True, help_text="Additional event data")
    triggered_by = models.CharField(max_length=255, null=True, blank=True, help_text="User or system that triggered the event")
    
    # Sync tracking
    synced_to_pops = models.BooleanField(default=False)
    sync_attempted_at = models.DateTimeField(null=True, blank=True)
    sync_error = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'order_events'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['shipment', '-created_at']),
            models.Index(fields=['event_type', '-created_at']),
            models.Index(fields=['synced_to_pops', 'sync_attempted_at']),
        ]
    
    def __str__(self):
        return f"{self.get_event_type_display()} - Shipment {self.shipment.id} at {self.created_at}"


class Zone(models.Model):
    """
    Zone/Area planning for route optimization
    """
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    
    # Geographic boundaries (polygon coordinates)
    boundaries = models.JSONField(null=True, blank=True, help_text="Array of [lat, lng] coordinates defining zone polygon")
    center_latitude = models.FloatField(null=True, blank=True)
    center_longitude = models.FloatField(null=True, blank=True)
    
    # Zone metadata
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    pincode = models.CharField(max_length=20, null=True, blank=True)
    
    # Capacity and assignment
    max_shipments = models.IntegerField(default=50, help_text="Maximum shipments per zone per day")
    assigned_riders = models.ManyToManyField(
        'authentication.RiderAccount',
        related_name='zones',
        blank=True
    )
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'zones'
        ordering = ['name']
        indexes = [
            models.Index(fields=['city', 'is_active']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.city or 'N/A'})"


class AcknowledgmentSettings(models.Model):
    """
    Region-based acknowledgment requirements
    Controls whether signature, photo, or both are mandatory/optional
    """
    REQUIREMENT_CHOICES = [
        ('mandatory', 'Mandatory'),
        ('optional', 'Optional'),
        ('either', 'Either (one of signature or photo required)'),
    ]
    
    id = models.AutoField(primary_key=True)
    
    # Region identification (can be city, state, or custom region name)
    region = models.CharField(max_length=100, unique=True, help_text="Region identifier (city, state, or custom name)")
    region_display_name = models.CharField(max_length=255, help_text="Display name for the region")
    
    # Signature requirements
    signature_required = models.CharField(
        max_length=20,
        choices=REQUIREMENT_CHOICES,
        default='optional',
        help_text="Signature requirement: mandatory, optional, or either"
    )
    
    # Photo requirements
    photo_required = models.CharField(
        max_length=20,
        choices=REQUIREMENT_CHOICES,
        default='optional',
        help_text="Photo requirement: mandatory, optional, or either"
    )
    
    # PDF settings
    require_pdf = models.BooleanField(default=False, help_text="Whether to require PDF document for signing")
    pdf_template_url = models.TextField(null=True, blank=True, help_text="URL to PDF template for this region")
    
    # Additional settings
    allow_skip_acknowledgment = models.BooleanField(
        default=False,
        help_text="Allow riders to skip acknowledgment in exceptional cases"
    )
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledgment_settings_created'
    )
    
    class Meta:
        db_table = 'acknowledgment_settings'
        ordering = ['region']
        indexes = [
            models.Index(fields=['region', 'is_active']),
            models.Index(fields=['is_active']),
        ]
        verbose_name = 'Acknowledgment Setting'
        verbose_name_plural = 'Acknowledgment Settings'
    
    def __str__(self):
        return f"{self.region_display_name} (Signature: {self.signature_required}, Photo: {self.photo_required})"
    
    def get_requirements(self):
        """
        Get human-readable requirements summary
        """
        requirements = []
        if self.signature_required == 'mandatory':
            requirements.append("Signature is mandatory")
        elif self.signature_required == 'either':
            requirements.append("Signature or Photo required")
        else:
            requirements.append("Signature is optional")
        
        if self.photo_required == 'mandatory':
            requirements.append("Photo is mandatory")
        elif self.photo_required == 'either':
            requirements.append("Photo or Signature required")
        else:
            requirements.append("Photo is optional")
        
        if self.require_pdf:
            requirements.append("PDF signing required")
        
        return "; ".join(requirements)
    
    def validate_acknowledgment(self, has_signature: bool, has_photo: bool) -> tuple[bool, str]:
        """
        Validate if acknowledgment meets requirements
        
        Returns:
            (is_valid, error_message)
        """
        # Check signature requirement
        if self.signature_required == 'mandatory' and not has_signature:
            return False, "Signature is mandatory for this region"
        
        # Check photo requirement
        if self.photo_required == 'mandatory' and not has_photo:
            return False, "Photo is mandatory for this region"
        
        # Check "either" requirement
        if self.signature_required == 'either' and self.photo_required == 'either':
            if not has_signature and not has_photo:
                return False, "Either signature or photo is required for this region"
        elif self.signature_required == 'either' and not has_signature and not has_photo:
            return False, "Either signature or photo is required for this region"
        elif self.photo_required == 'either' and not has_signature and not has_photo:
            return False, "Either signature or photo is required for this region"
        
        return True, ""


