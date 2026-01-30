"""
Resources for CSV import/export in routes app
"""
from import_export import resources
from .models import RouteSession, RouteTracking


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

