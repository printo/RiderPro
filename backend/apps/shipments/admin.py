"""
Django admin configuration for shipments app
Includes CSV import/export functionality
Includes route tracking admin
"""
from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Shipment, Acknowledgment, RouteSession, RouteTracking
from .resources import (
    ShipmentResource, AcknowledgmentResource,
    RouteSessionResource, RouteTrackingResource
)


class AcknowledgmentInline(admin.TabularInline):
    """Inline admin for Acknowledgment"""
    model = Acknowledgment
    extra = 0
    readonly_fields = ('acknowledgment_captured_at',)
    fields = ('signature_url', 'photo_url', 'acknowledgment_captured_by', 'acknowledgment_captured_at')


@admin.register(Shipment)
class ShipmentAdmin(ImportExportModelAdmin):
    """Admin interface for Shipment model"""
    resource_class = ShipmentResource
    
    list_display = [
        'id',
        'customer_name',
        'customer_mobile',
        'type',
        'status',
        'route_name',
        'employee_id',
        'delivery_time',
        'cost',
        'synced_to_external',
        'sync_status',
        'created_at',
    ]
    
    list_filter = [
        'type',
        'status',
        'sync_status',
        'synced_to_external',
        'priority',
        ('delivery_time', admin.DateFieldListFilter),
        ('created_at', admin.DateFieldListFilter),
        ('updated_at', admin.DateFieldListFilter),
        ('acknowledgment_captured_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'id',
        'customer_name',
        'customer_mobile',
        'address',
        'route_name',
        'employee_id',
        'pops_order_id',
        'pops_shipment_uuid',
    ]
    
    readonly_fields = (
        'id', 'created_at', 'updated_at', 'last_sync_attempt',
        'acknowledgment_captured_at'
    )
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'type', 'customer_name', 'customer_mobile', 'address')
        }),
        ('Location', {
            'fields': ('latitude', 'longitude', 'route_name')
        }),
        ('Delivery Details', {
            'fields': (
                'delivery_time', 'actual_delivery_time', 'employee_id',
                'cost', 'weight', 'dimensions', 'priority'
            )
        }),
        ('Status', {
            'fields': ('status', 'remarks', 'special_instructions')
        }),
        ('Pickup Information', {
            'fields': ('pickup_address',),
            'classes': ('collapse',)
        }),
        ('GPS Tracking', {
            'fields': (
                'start_latitude', 'start_longitude',
                'stop_latitude', 'stop_longitude', 'km_travelled'
            ),
            'classes': ('collapse',)
        }),
        ('Acknowledgment', {
            'fields': (
                'signature_url', 'photo_url', 'acknowledgment_captured_by',
                'acknowledgment_captured_at'
            ),
            'classes': ('collapse',)
        }),
        ('POPS Integration', {
            'fields': (
                'pops_order_id', 'pops_shipment_uuid',
                'synced_to_external', 'sync_status', 'sync_attempts',
                'last_sync_attempt', 'sync_error'
            ),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [AcknowledgmentInline]
    
    actions = ['mark_as_delivered', 'mark_as_in_transit', 'mark_as_returned', 'sync_to_pops']
    
    def mark_as_delivered(self, request, queryset):
        """Mark selected shipments as delivered"""
        count = queryset.update(status='Delivered')
        self.message_user(request, f'{count} shipments marked as delivered.')
    mark_as_delivered.short_description = "Mark as delivered"
    
    def mark_as_in_transit(self, request, queryset):
        """Mark selected shipments as in transit"""
        count = queryset.update(status='In Transit')
        self.message_user(request, f'{count} shipments marked as in transit.')
    mark_as_in_transit.short_description = "Mark as in transit"
    
    def mark_as_returned(self, request, queryset):
        """Mark selected shipments as returned"""
        count = queryset.update(status='Returned')
        self.message_user(request, f'{count} shipments marked as returned.')
    mark_as_returned.short_description = "Mark as returned"
    
    def sync_to_pops(self, request, queryset):
        """Mark selected shipments for sync to POPS"""
        count = queryset.update(sync_status='pending', synced_to_external=False)
        self.message_user(request, f'{count} shipments marked for sync to POPS.')
    sync_to_pops.short_description = "Mark for POPS sync"


@admin.register(Acknowledgment)
class AcknowledgmentAdmin(ImportExportModelAdmin):
    """Admin interface for Acknowledgment model"""
    resource_class = AcknowledgmentResource
    
    list_display = [
        'shipment',
        'shipment__customer_name',
        'acknowledgment_captured_by',
        'acknowledgment_captured_at',
        'has_signature',
        'has_photo',
    ]
    
    list_filter = [
        ('acknowledgment_captured_at', admin.DateFieldListFilter),
    ]
    
    search_fields = [
        'shipment__id',
        'shipment__customer_name',
        'shipment__customer_mobile',
        'acknowledgment_captured_by',
    ]
    
    readonly_fields = ('acknowledgment_captured_at',)
    
    def shipment__customer_name(self, obj):
        """Display customer name from shipment"""
        return obj.shipment.customer_name
    shipment__customer_name.short_description = 'Customer Name'
    
    def has_signature(self, obj):
        """Check if signature exists"""
        return bool(obj.signature_url)
    has_signature.boolean = True
    has_signature.short_description = 'Has Signature'
    
    def has_photo(self, obj):
        """Check if photo exists"""
        return bool(obj.photo_url)
    has_photo.boolean = True
    has_photo.short_description = 'Has Photo'


# Route tracking admin
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
