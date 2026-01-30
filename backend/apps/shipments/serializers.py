"""
Serializers for shipments app
Includes route tracking serializers
"""
from rest_framework import serializers
from .models import Shipment, Acknowledgment, RouteSession, RouteTracking


class ShipmentSerializer(serializers.ModelSerializer):
    """Shipment serializer"""
    
    class Meta:
        model = Shipment
        fields = [
            'id', 'type', 'customer_name', 'customer_mobile', 'address',
            'latitude', 'longitude', 'cost', 'delivery_time', 'route_name',
            'employee_id', 'status', 'pickup_address', 'weight', 'dimensions',
            'special_instructions', 'actual_delivery_time', 'priority', 'remarks',
            'start_latitude', 'start_longitude', 'stop_latitude', 'stop_longitude',
            'km_travelled', 'synced_to_external', 'sync_status', 'sync_attempts',
            'signature_url', 'photo_url', 'acknowledgment_captured_at',
            'acknowledgment_captured_by', 'pops_order_id', 'pops_shipment_uuid',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ShipmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating shipments"""
    
    class Meta:
        model = Shipment
        fields = [
            'id', 'type', 'customer_name', 'customer_mobile', 'address',
            'latitude', 'longitude', 'cost', 'delivery_time', 'route_name',
            'employee_id', 'status', 'pickup_address', 'weight', 'dimensions',
            'special_instructions', 'priority', 'pops_order_id', 'pops_shipment_uuid'
        ]


class ShipmentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating shipments"""
    
    class Meta:
        model = Shipment
        fields = [
            'status', 'remarks', 'actual_delivery_time', 'priority',
            'start_latitude', 'start_longitude', 'stop_latitude', 'stop_longitude',
            'km_travelled'
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
    delivered_shipments = serializers.IntegerField()
    picked_up_shipments = serializers.IntegerField()
    returned_shipments = serializers.IntegerField()
    cancelled_shipments = serializers.IntegerField()
    total_revenue = serializers.FloatField()
    average_delivery_time = serializers.FloatField()


# Route tracking serializers
class RouteSessionSerializer(serializers.ModelSerializer):
    """Route session serializer"""
    tracking_points = serializers.SerializerMethodField()
    
    class Meta:
        model = RouteSession
        fields = [
            'id', 'employee_id', 'start_time', 'end_time', 'status',
            'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
            'total_distance', 'total_time', 'fuel_consumed', 'fuel_cost',
            'average_speed', 'shipments_completed', 'shipment_id',
            'created_at', 'updated_at', 'tracking_points'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_tracking_points(self, obj):
        """Get tracking points for this session"""
        points = obj.tracking_points.all()[:100]  # Limit to 100 points
        return RouteTrackingSerializer(points, many=True).data


class RouteTrackingSerializer(serializers.ModelSerializer):
    """Route tracking (GPS coordinates) serializer"""
    
    class Meta:
        model = RouteTracking
        fields = [
            'id', 'session', 'employee_id', 'latitude', 'longitude',
            'timestamp', 'date', 'accuracy', 'speed', 'event_type',
            'shipment_id', 'fuel_efficiency', 'fuel_price'
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
    session_id = serializers.CharField(required=False)
    sessionId = serializers.CharField(required=False)  # Accept camelCase from frontend
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    accuracy = serializers.FloatField(required=False, allow_null=True)
    speed = serializers.FloatField(required=False, allow_null=True)
    timestamp = serializers.DateTimeField(required=False)
    
    def validate(self, data):
        """Normalize session_id from either sessionId or session_id"""
        # Get session_id from either field
        session_id = data.get('session_id') or data.get('sessionId')
        if not session_id:
            raise serializers.ValidationError({
                'session_id': 'This field is required.'
            })
        # Normalize to session_id
        data['session_id'] = session_id
        # Remove sessionId if it exists
        if 'sessionId' in data:
            del data['sessionId']
        return data


class ShipmentEventSerializer(serializers.Serializer):
    """Serializer for shipment event"""
    session_id = serializers.CharField()
    shipment_id = serializers.CharField()
    event_type = serializers.ChoiceField(choices=['pickup', 'delivery'])
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()






