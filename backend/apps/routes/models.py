"""
Route tracking models for RiderPro
Tracks GPS coordinates and route sessions
"""
from django.db import models
from django.conf import settings


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
    
    # Current Location Cache (for real-time maps)
    current_latitude = models.FloatField(null=True, blank=True)
    current_longitude = models.FloatField(null=True, blank=True)
    last_updated = models.DateTimeField(null=True, blank=True)
    
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
