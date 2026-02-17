"""
Serializers for shipments app
Includes route tracking serializers
"""
from rest_framework import serializers
from .models import Shipment, Acknowledgment, RouteSession, RouteTracking, AcknowledgmentSettings


def format_address(address_data):
    """
    Format address JSON object into a readable string.
    Handles both dict and string addresses.
    """
    if not address_data:
        return 'No address'
    
    if isinstance(address_data, str):
        return address_data
    
    if not isinstance(address_data, dict):
        return str(address_data)
    
    # Build address string from object fields
    parts = []
    
    # Try common address field names
    if address_data.get('address'):
        parts.append(str(address_data['address']))
    elif address_data.get('place_name'):
        parts.append(str(address_data['place_name']))
    
    if address_data.get('city'):
        parts.append(str(address_data['city']))
    
    if address_data.get('state'):
        parts.append(str(address_data['state']))
    
    if address_data.get('pincode'):
        parts.append(str(address_data['pincode']))
    
    if address_data.get('country'):
        parts.append(str(address_data['country']))
    
    return ', '.join(parts) if parts else 'No address'


class ShipmentSerializer(serializers.ModelSerializer):
    """Serializer for shipments"""

    # Formatted address string for display (handles both object and string addresses)
    address_display = serializers.SerializerMethodField()
    
    def get_address_display(self, obj):
        """Format address for display"""
        return format_address(obj.address)

    class Meta:
        model = Shipment
        fields = [
            'id', 'type', 'customer_name', 'customer_mobile', 'address',
            'latitude', 'longitude', 'cost', 'delivery_time', 'route_name',
            'employee_id', 'status', 'pickup_address', 'weight', 'package_boxes',
            'special_instructions', 'actual_delivery_time', 'priority', 'remarks',
            'start_latitude', 'start_longitude', 'stop_latitude', 'stop_longitude',
            'km_travelled', 'synced_to_external', 'sync_status', 'sync_attempts',
            'signature_url', 'photo_url', 'pdf_url', 'signed_pdf_url',
            'acknowledgment_captured_at', 'acknowledgment_captured_by',
            'pops_order_id', 'pops_shipment_uuid', 'api_source', 'region',
            'created_at', 'updated_at', 'address_display',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ShipmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating shipments"""
    
    class Meta:
        model = Shipment
        fields = [
            'id', 'type', 'customer_name', 'customer_mobile', 'address',
            'latitude', 'longitude', 'cost', 'delivery_time', 'route_name',
            'employee_id', 'status', 'pickup_address', 'weight', 'package_boxes',
            'special_instructions', 'priority', 'pops_order_id', 'pops_shipment_uuid'
        ]


class ShipmentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating shipments - allows managers to update route, remarks, special_instructions"""
    
    class Meta:
        model = Shipment
        fields = [
            'status', 'remarks', 'actual_delivery_time', 'priority',
            'start_latitude', 'start_longitude', 'stop_latitude', 'stop_longitude',
            'km_travelled', 'route_name', 'special_instructions', 'employee_id'
        ]


class AcknowledgmentSerializer(serializers.ModelSerializer):
    """Acknowledgment serializer"""
    
    class Meta:
        model = Acknowledgment
        fields = [
            'shipment', 'signature_url', 'photo_url',
            'acknowledgment_captured_at', 'acknowledgment_captured_by'
        ]
        read_only_fields = ['acknowledgment_captured_at']


class DashboardMetricsSerializer(serializers.Serializer):
    """Dashboard metrics serializer"""
    total_shipments = serializers.IntegerField()
    pending_shipments = serializers.IntegerField()
    in_transit_shipments = serializers.IntegerField()
    in_progress_shipments = serializers.IntegerField()
    delivered_shipments = serializers.IntegerField()
    picked_up_shipments = serializers.IntegerField()
    returned_shipments = serializers.IntegerField()
    cancelled_shipments = serializers.IntegerField()
    total_revenue = serializers.FloatField()
    average_delivery_time = serializers.FloatField()


class RouteSessionSerializer(serializers.ModelSerializer):
    """Route session serializer"""
    tracking_points = serializers.SerializerMethodField()
    
    class Meta:
        model = RouteSession
        fields = [
            'id', 'employee_id', 'start_time', 'end_time', 'status',
            'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
            'current_latitude', 'current_longitude', 'last_updated',
            'total_distance', 'total_time', 'fuel_consumed', 'fuel_cost',
            'average_speed', 'shipments_completed', 'shipment_id',
            'created_at', 'updated_at', 'tracking_points',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_tracking_points(self, obj):
        """Get tracking points for this session"""
        points = obj.tracking_points.all()[:100]  # Limit to 100 points
        return RouteTrackingSerializer(points, many=True).data


class RouteTrackingSerializer(serializers.ModelSerializer):
    """Route tracking serializer"""
    class Meta:
        model = RouteTracking
        fields = [
            'id', 'session', 'employee_id', 'latitude', 'longitude',
            'timestamp', 'date', 'accuracy', 'speed', 'event_type',
            'shipment_id', 'fuel_efficiency', 'fuel_price',
        ]
        read_only_fields = ['id', 'date']


class RouteSessionCreateSerializer(serializers.Serializer):
    """Serializer for creating route session"""
    start_latitude = serializers.FloatField()
    start_longitude = serializers.FloatField()
    shipment_id = serializers.CharField(required=False, allow_null=True)


class RouteSessionStopSerializer(serializers.Serializer):
    """Serializer for stopping route session"""
    session_id = serializers.CharField()
    end_latitude = serializers.FloatField()
    end_longitude = serializers.FloatField()


class CoordinateSerializer(serializers.Serializer):
    """Serializer for GPS coordinates"""
    session_id = serializers.CharField(required=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    accuracy = serializers.FloatField(required=False, allow_null=True)
    speed = serializers.FloatField(required=False, allow_null=True)
    timestamp = serializers.DateTimeField(required=False)
    
    def validate(self, data):
        """Normalize session_id"""
        return data


class RouteLocationSerializer(serializers.Serializer):
    """Simple location serializer for optimization"""
    id = serializers.CharField(required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    shipment_id = serializers.CharField(required=False)

    def validate(self, data):
        return data


class RouteOptimizeRequestSerializer(serializers.Serializer):
    """Serializer for route optimization request"""
    current_latitude = serializers.FloatField(required=False)
    current_longitude = serializers.FloatField(required=False)
    locations = RouteLocationSerializer(many=True)

    def validate(self, data):
        if data.get('current_latitude') is None or data.get('current_longitude') is None:
            raise serializers.ValidationError('Current location is required.')

        return data


class AcknowledgmentSettingsSerializer(serializers.ModelSerializer):
    """Serializer for AcknowledgmentSettings"""
    
    class Meta:
        model = AcknowledgmentSettings
        fields = [
            'id', 'region', 'region_display_name',
            'signature_required', 'photo_required', 'require_pdf',
            'pdf_template_url', 'allow_skip_acknowledgment',
            'is_active', 'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChangeRiderSerializer(serializers.Serializer):
    """Serializer for changing shipment rider"""
    employee_id = serializers.CharField(required=True, help_text="New rider employee ID")
    reason = serializers.CharField(required=False, allow_blank=True, help_text="Reason for rider change")


class BatchChangeRiderSerializer(serializers.Serializer):
    """Serializer for batch changing shipment riders"""
    shipment_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        help_text="List of shipment IDs to update"
    )
    employee_id = serializers.CharField(required=True, help_text="New rider employee ID")
    reason = serializers.CharField(required=False, allow_blank=True, help_text="Reason for rider change")


class ShipmentEventSerializer(serializers.Serializer):
    """Serializer for shipment event"""
    session_id = serializers.CharField()
    shipment_id = serializers.CharField()
    event_type = serializers.ChoiceField(choices=['pickup', 'delivery'])
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class BulkShipmentEventSerializer(serializers.Serializer):
    """Serializer for bulk shipment events at one location"""
    session_id = serializers.CharField(required=True)
    shipment_ids = serializers.ListField(child=serializers.CharField(), required=True)
    event_type = serializers.ChoiceField(choices=['pickup', 'delivery'], required=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    def validate(self, data):
        return data
