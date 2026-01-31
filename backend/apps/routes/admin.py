"""
Django admin configuration for routes app
Includes CSV import/export functionality
"""
from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import RouteSession, RouteTracking
from .resources import RouteSessionResource, RouteTrackingResource


class RouteTrackingInline(admin.TabularInline):
    """Inline admin for RouteTracking"""
    model = RouteTracking
    extra = 0
    readonly_fields = ('timestamp', 'date')
    fields = ('employee_id', 'latitude', 'longitude', 'timestamp', 'event_type', 'shipment_id')
    show_change_link = True


@admin.register(RouteSession)
class RouteSessionAdmin(ImportExportModelAdmin):
    """Admin interface for RouteSession model"""
    resource_class = RouteSessionResource
    
    list_display = [
        'id',
        'employee_id',
        'start_time',
        'end_time',
        'status',
        'total_distance',
        'total_time',
        'fuel_consumed',
        'fuel_cost',
        'average_speed',
        'shipments_completed',
        'created_at',
    ]
    
    list_filter = [
        'status',
        ('start_time', admin.DateFieldListFilter),
        ('end_time', admin.DateFieldListFilter),
        ('created_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'id',
        'employee_id',
        'shipment_id',
    ]
    
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Session Information', {
            'fields': ('id', 'employee_id', 'status', 'shipment_id')
        }),
        ('Timing', {
            'fields': ('start_time', 'end_time', 'total_time')
        }),
        ('GPS Coordinates', {
            'fields': (
                'start_latitude', 'start_longitude',
                'end_latitude', 'end_longitude'
            )
        }),
        ('Metrics', {
            'fields': (
                'total_distance', 'average_speed',
                'fuel_consumed', 'fuel_cost', 'shipments_completed'
            )
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [RouteTrackingInline]
    
    actions = ['mark_as_completed', 'mark_as_paused']
    
    def mark_as_completed(self, request, queryset):
        """Mark selected sessions as completed"""
        from django.utils import timezone
        count = queryset.update(status='completed', end_time=timezone.now())
        self.message_user(request, f'{count} sessions marked as completed.')
    mark_as_completed.short_description = "Mark as completed"
    
    def mark_as_paused(self, request, queryset):
        """Mark selected sessions as paused"""
        count = queryset.update(status='paused')
        self.message_user(request, f'{count} sessions marked as paused.')
    mark_as_paused.short_description = "Mark as paused"


@admin.register(RouteTracking)
class RouteTrackingAdmin(ImportExportModelAdmin):
    """Admin interface for RouteTracking model"""
    resource_class = RouteTrackingResource
    
    list_display = [
        'id',
        'session',
        'employee_id',
        'latitude',
        'longitude',
        'timestamp',
        'date',
        'event_type',
        'speed',
        'accuracy',
        'shipment_id',
    ]
    
    list_filter = [
        'event_type',
        ('timestamp', admin.DateFieldListFilter),
        ('date', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'session__id',
        'employee_id',
        'shipment_id',
    ]
    
    readonly_fields = ('id', 'date', 'timestamp')
    
    fieldsets = (
        ('Tracking Information', {
            'fields': ('session', 'employee_id', 'event_type', 'shipment_id')
        }),
        ('GPS Data', {
            'fields': ('latitude', 'longitude', 'timestamp', 'date', 'accuracy', 'speed')
        }),
        ('Fuel Calculation', {
            'fields': ('fuel_efficiency', 'fuel_price'),
            'classes': ('collapse',)
        }),
    )
    
    date_hierarchy = 'date'
