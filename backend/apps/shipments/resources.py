"""
Resources for CSV import/export in shipments app
Includes route tracking resources
"""
from import_export import resources
from .models import Shipment, Acknowledgment, RouteSession, RouteTracking


class ShipmentResource(resources.ModelResource):
    """Resource for Shipment model CSV import/export"""
    class Meta:
        model = Shipment
        fields = (
            'id', 'type', 'customer_name', 'customer_mobile', 'address',
            'latitude', 'longitude', 'cost', 'delivery_time', 'route_name',
            'employee_id', 'status', 'pickup_address', 'weight', 'package_boxes',
            'special_instructions', 'actual_delivery_time', 'priority',
            'remarks', 'start_latitude', 'start_longitude', 'stop_latitude',
            'stop_longitude', 'km_travelled', 'synced_to_external',
            'last_sync_attempt', 'sync_error', 'sync_status', 'sync_attempts',
            'signature_url', 'photo_url', 'acknowledgment_captured_at',
            'acknowledgment_captured_by', 'pops_order_id', 'pops_shipment_uuid',
            'created_at', 'updated_at'
        )
        export_order = (
            'id', 'type', 'customer_name', 'customer_mobile', 'address',
            'latitude', 'longitude', 'cost', 'delivery_time', 'route_name',
            'employee_id', 'status', 'pickup_address', 'weight', 'package_boxes',
            'special_instructions', 'actual_delivery_time', 'priority',
            'remarks', 'start_latitude', 'start_longitude', 'stop_latitude',
            'stop_longitude', 'km_travelled', 'synced_to_external',
            'last_sync_attempt', 'sync_error', 'sync_status', 'sync_attempts',
            'signature_url', 'photo_url', 'acknowledgment_captured_at',
            'acknowledgment_captured_by', 'pops_order_id', 'pops_shipment_uuid',
            'created_at', 'updated_at'
        )


class AcknowledgmentResource(resources.ModelResource):
    """Resource for Acknowledgment model CSV import/export"""
    class Meta:
        model = Acknowledgment
        fields = (
            'shipment__id', 'shipment__customer_name', 'signature_url',
            'photo_url', 'acknowledgment_captured_at', 'acknowledgment_captured_by'
        )
        export_order = (
            'shipment__id', 'shipment__customer_name', 'signature_url',
            'photo_url', 'acknowledgment_captured_at', 'acknowledgment_captured_by'
        )


class RouteSessionResource(resources.ModelResource):
    """Resource for RouteSession model CSV import/export"""
    class Meta:
        model = RouteSession
        fields = (
            'id', 'employee_id', 'start_time', 'end_time', 'status',
            'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
            'total_distance', 'total_time', 'fuel_consumed', 'fuel_cost',
            'average_speed', 'shipments_completed', 'shipment_id',
            'created_at', 'updated_at'
        )
        export_order = (
            'id', 'employee_id', 'start_time', 'end_time', 'status',
            'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
            'total_distance', 'total_time', 'fuel_consumed', 'fuel_cost',
            'average_speed', 'shipments_completed', 'shipment_id',
            'created_at', 'updated_at'
        )


class RouteTrackingResource(resources.ModelResource):
    """Resource for RouteTracking model CSV import/export"""
    class Meta:
        model = RouteTracking
        fields = (
            'id', 'session__id', 'session__employee_id', 'employee_id',
            'latitude', 'longitude', 'timestamp', 'date', 'accuracy', 'speed',
            'event_type', 'shipment_id', 'fuel_efficiency', 'fuel_price'
        )
        export_order = (
            'id', 'session__id', 'session__employee_id', 'employee_id',
            'latitude', 'longitude', 'timestamp', 'date', 'accuracy', 'speed',
            'event_type', 'shipment_id', 'fuel_efficiency', 'fuel_price'
        )



