"""
Django admin configuration for shipments app
Includes CSV import/export functionality
Includes route tracking admin
"""
from django.contrib import admin
from django.utils.html import format_html
from import_export.admin import ImportExportModelAdmin
from django_json_widget.widgets import JSONEditorWidget
from django.db import models

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
    
    formfield_overrides = {
        models.JSONField: {"widget": JSONEditorWidget},
    }
    
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
        'package_boxes_display',  # Put this first so it appears at the top
        'id', 'created_at', 'updated_at', 'last_sync_attempt',
        'acknowledgment_captured_at', 'pia_link',
    )
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('type', 'customer_name', 'customer_mobile')
        }),
        ('Location', {
            'fields': ('latitude', 'longitude', 'route_name')
        }),
        ('Delivery Details', {
            'fields': (
                'delivery_time', 'actual_delivery_time', 'employee_id',
                'cost', 'weight', 'priority'
            )
        }),
        ('Package Boxes Display', {
            'fields': ('package_boxes_display',),
            'classes': ('wide',),
            'description': 'Formatted table view of package boxes'
        }),
        ('Package Boxes', {
            'fields': ('package_boxes',),
            'description': 'Edit the JSON data for package boxes. The formatted table is shown above in the readonly section. Uses JSONEditorWidget for editing.',
            'classes': ('collapse',)
        }),
        ('Addresses (JSON)', {
            'fields': ('address', 'pickup_address'),
            'description': 'Address fields in JSON format. Uses JSONEditorWidget for editing.',
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('status', 'remarks', 'special_instructions')
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
                'acknowledgment_captured_at'  # This is in readonly_fields but can be in fieldset
            ),
            'classes': ('collapse',)
        }),
        ('POPS Integration', {
            'fields': (
                'pops_order_id', 'pops_shipment_uuid', 'pia_link',  # 'pia_link' is a method in readonly_fields
                'synced_to_external', 'sync_status', 'sync_attempts',
                'last_sync_attempt', 'sync_error'  # 'last_sync_attempt' is in readonly_fields
            ),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),  # These are in readonly_fields
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
    
    def pia_link(self, obj):
        """Generate PIA link for this shipment"""
        from django.conf import settings
        pia_base_url = getattr(settings, 'PIA_BASE_URL', None)
        if not pia_base_url or not obj.pops_order_id:
            return "N/A"
        pia_url = f"{pia_base_url.rstrip('/')}/admin/deliveryq/order/{obj.pops_order_id}/"
        return format_html('<a href="{}" target="_blank">View in PIA</a>', pia_url)
    pia_link.short_description = 'PIA Link'
    
    def package_boxes_display(self, obj):
        """Display package boxes in a formatted way"""
        if not obj or not obj.package_boxes:
            return format_html('<div style="padding: 10px; color: #666;">No package boxes data available</div>')
        
        import json
        try:
            if isinstance(obj.package_boxes, str):
                boxes = json.loads(obj.package_boxes)
            else:
                boxes = obj.package_boxes
            
            if not isinstance(boxes, list) or len(boxes) == 0:
                return format_html('<div style="padding: 10px; color: #666;">No package boxes found</div>')
            
            # Create a formatted display with separate columns for length, breadth, height (like POPS)
            html_parts = ['<div style="max-height: 400px; overflow-y: auto; margin: 10px 0;">']
            html_parts.append('<table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #ddd;">')
            html_parts.append('<thead><tr style="background-color: #f5f5f5; font-weight: bold;">')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">#</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">SKU</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Name</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Qty</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Length (cm)</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Breadth (cm)</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Height (cm)</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Volume (cm³)</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Weight (kg)</th>')
            html_parts.append('<th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Price</th>')
            html_parts.append('</tr></thead><tbody>')
            
            for i, box in enumerate(boxes, 1):
                dims = box.get('dimensions', {})
                length = dims.get('length', 0) if isinstance(dims, dict) else 0
                breadth = dims.get('breadth', 0) if isinstance(dims, dict) else 0
                height = dims.get('height', 0) if isinstance(dims, dict) else 0
                volume = box.get('volume', length * breadth * height if length and breadth and height else 0)
                
                html_parts.append('<tr>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd;">{i}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd;">{box.get("sku", "N/A")}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd;">{box.get("name", "N/A")}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd; text-align: right;">{box.get("quantity", 0)} {box.get("quantity_unit", "Pc")}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd; text-align: right;">{length:.2f}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd; text-align: right;">{breadth:.2f}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd; text-align: right;">{height:.2f}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd; text-align: right;">{volume:.2f}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd; text-align: right;">{box.get("weight", 0):.2f}</td>')
                html_parts.append(f'<td style="padding: 6px; border: 1px solid #ddd; text-align: right;">₹{box.get("price", 0):.2f}</td>')
                html_parts.append('</tr>')
            
            html_parts.append('</tbody></table>')
            html_parts.append('</div>')
            
            return format_html(''.join(html_parts))
        except Exception as e:
            return format_html('<div style="padding: 10px; color: red;">Error displaying package boxes: {}</div>', str(e))
    package_boxes_display.short_description = 'Package Boxes'


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


