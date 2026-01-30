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
    # Primary identifier (from POPS Order.id or external ID)
    id = models.CharField(max_length=255, primary_key=True)
    
    # Basic shipment info
    type = models.CharField(
        max_length=50,
        choices=[
            ('delivery', 'Delivery'),
            ('pickup', 'Pickup'),
        ]
    )
    customer_name = models.TextField()
    customer_mobile = models.TextField()
    address = models.TextField()
    
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
            ('Assigned', 'Assigned'),
            ('In Transit', 'In Transit'),
            ('Delivered', 'Delivered'),
            ('Picked Up', 'Picked Up'),
            ('Returned', 'Returned'),
            ('Cancelled', 'Cancelled'),
        ],
        default='Assigned'
    )
    
    # Additional details
    pickup_address = models.TextField(null=True, blank=True)
    weight = models.FloatField(default=0)
    dimensions = models.TextField(null=True, blank=True)
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
    acknowledgment_captured_at = models.DateTimeField(null=True, blank=True)
    acknowledgment_captured_by = models.CharField(max_length=255, null=True, blank=True)
    
    # POPS integration
    pops_order_id = models.IntegerField(null=True, blank=True, db_index=True)  # POPS Order.id
    pops_shipment_uuid = models.CharField(max_length=255, null=True, blank=True)
    
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
