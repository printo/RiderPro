"""
Vehicle types and fuel settings models
"""
from django.db import models


class VehicleType(models.Model):
    """
    Vehicle type configuration
    Used for fuel cost calculations
    """
    id = models.CharField(max_length=255, primary_key=True)
    name = models.CharField(max_length=255)
    fuel_efficiency = models.FloatField()  # km per liter
    description = models.TextField(null=True, blank=True)
    icon = models.CharField(max_length=50, default='car')
    fuel_type = models.CharField(
        max_length=50,
        choices=[
            ('petrol', 'Petrol'),
            ('diesel', 'Diesel'),
            ('electric', 'Electric'),
        ],
        default='petrol'
    )
    co2_emissions = models.FloatField(null=True, blank=True)  # grams per km
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'vehicle_types'
    
    def __str__(self):
        return f"{self.name} ({self.fuel_type})"


class FuelSetting(models.Model):
    """
    Fuel pricing settings
    Used for route cost calculations
    """
    id = models.CharField(max_length=255, primary_key=True)
    fuel_type = models.CharField(
        max_length=50,
        choices=[
            ('petrol', 'Petrol'),
            ('diesel', 'Diesel'),
            ('electric', 'Electric'),
        ],
        default='petrol'
    )
    price_per_liter = models.FloatField()
    currency = models.CharField(max_length=10, default='USD')
    region = models.CharField(max_length=100, null=True, blank=True)
    effective_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_by = models.CharField(max_length=255, null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'fuel_settings'
        indexes = [
            models.Index(fields=['fuel_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.fuel_type} - {self.price_per_liter} {self.currency}"
