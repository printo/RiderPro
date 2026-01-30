"""
Django admin configuration for vehicles app
Includes CSV import/export functionality
"""
from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import VehicleType, FuelSetting
from .resources import VehicleTypeResource, FuelSettingResource


@admin.register(VehicleType)
class VehicleTypeAdmin(ImportExportModelAdmin):
    """Admin interface for VehicleType model"""
    resource_class = VehicleTypeResource
    
    list_display = [
        'id',
        'name',
        'fuel_type',
        'fuel_efficiency',
        'co2_emissions',
        'icon',
        'created_at',
    ]
    
    list_filter = [
        'fuel_type',
        ('created_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'id',
        'name',
        'description',
    ]
    
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'description', 'icon')
        }),
        ('Fuel Configuration', {
            'fields': ('fuel_type', 'fuel_efficiency', 'co2_emissions')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(FuelSetting)
class FuelSettingAdmin(ImportExportModelAdmin):
    """Admin interface for FuelSetting model"""
    resource_class = FuelSettingResource
    
    list_display = [
        'id',
        'fuel_type',
        'price_per_liter',
        'currency',
        'region',
        'effective_date',
        'is_active',
        'created_by',
        'created_at',
    ]
    
    list_filter = [
        'fuel_type',
        'is_active',
        'currency',
        'region',
        ('effective_date', admin.DateFieldListFilter),
        ('created_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'id',
        'fuel_type',
        'region',
        'created_by',
    ]
    
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Fuel Information', {
            'fields': ('id', 'fuel_type', 'price_per_liter', 'currency', 'region')
        }),
        ('Status', {
            'fields': ('is_active', 'effective_date', 'created_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['activate_settings', 'deactivate_settings']
    
    def activate_settings(self, request, queryset):
        """Activate selected fuel settings"""
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} fuel settings activated.')
    activate_settings.short_description = "Activate selected settings"
    
    def deactivate_settings(self, request, queryset):
        """Deactivate selected fuel settings"""
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} fuel settings deactivated.')
    deactivate_settings.short_description = "Deactivate selected settings"
