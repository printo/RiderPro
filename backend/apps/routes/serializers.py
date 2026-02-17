"""
Serializers for routes app
"""
from rest_framework import serializers
from .models import RouteSession, RouteTracking


class RouteSessionSerializer(serializers.ModelSerializer):
    """Route session serializer"""
    tracking_points = serializers.SerializerMethodField()
    rider_status = serializers.SerializerMethodField()

    class Meta:
        model = RouteSession
        fields = [
            'id', 'employee_id', 'start_time', 'end_time', 'status',
            'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
            'current_latitude', 'current_longitude', 'last_updated',
            'total_distance', 'total_time', 'fuel_consumed', 'fuel_cost',
            'average_speed', 'shipments_completed', 'shipment_id',
            'created_at', 'updated_at', 'tracking_points', 'rider_status'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_rider_status(self, obj):
        """Derived human-readable status"""
        if obj.status == 'active':
            return 'Online'
        if obj.status == 'paused':
            return 'Away'
        return 'Offline'
    
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
            'shipment_id', 'fuel_efficiency', 'fuel_price',
        ]
        read_only_fields = ['id', 'date']


class RouteSessionCreateSerializer(serializers.Serializer):
    """Serializer for creating route session"""
    start_latitude = serializers.FloatField(required=False)
    start_longitude = serializers.FloatField(required=False)
    shipment_id = serializers.CharField(required=False, allow_null=True)

    def validate(self, data):
        data['start_latitude'] = data.get('start_latitude')
        data['start_longitude'] = data.get('start_longitude')
        
        if data.get('start_latitude') is None or data.get('start_longitude') is None:
            raise serializers.ValidationError('Start location is required.')
            
        return data


class RouteSessionStopSerializer(serializers.Serializer):
    """Serializer for stopping route session"""
    session_id = serializers.CharField(required=False)
    end_latitude = serializers.FloatField(required=False)
    end_longitude = serializers.FloatField(required=False)

    def validate(self, data):
        data['session_id'] = data.get('session_id')
        data['end_latitude'] = data.get('end_latitude')
        data['end_longitude'] = data.get('end_longitude')
        
        required = ['session_id', 'end_latitude', 'end_longitude']
        for field in required:
            if data.get(field) is None:
                raise serializers.ValidationError({field: 'This field is required.'})
                
        return data


class CoordinateSerializer(serializers.Serializer):
    """Serializer for GPS coordinates"""
    session_id = serializers.CharField(required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    accuracy = serializers.FloatField(required=False, allow_null=True)
    speed = serializers.FloatField(required=False, allow_null=True)
    timestamp = serializers.DateTimeField(required=False)

    def validate(self, data):
        session_id = data.get('session_id')
        if not session_id:
            raise serializers.ValidationError({'session_id': 'This field is required.'})
        data['session_id'] = session_id
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
        data['current_latitude'] = data.get('current_latitude')
        data['current_longitude'] = data.get('current_longitude')
        
        if data.get('current_latitude') is None or data.get('current_longitude') is None:
             raise serializers.ValidationError('Current location is required.')
             
        return data


class ShipmentEventSerializer(serializers.Serializer):
    """Serializer for shipment event"""
    session_id = serializers.CharField(required=False)
    shipment_id = serializers.CharField(required=False)
    event_type = serializers.ChoiceField(choices=['pickup', 'delivery'], required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    def validate(self, data):
        data['session_id'] = data.get('session_id')
        data['shipment_id'] = data.get('shipment_id')
        data['event_type'] = data.get('event_type')
        
        required = ['session_id', 'shipment_id', 'event_type']
        for field in required:
            if not data.get(field):
                raise serializers.ValidationError({field: 'This field is required.'})
        
        return data


class BulkShipmentEventSerializer(serializers.Serializer):
    """Serializer for bulk shipment events at one location"""
    session_id = serializers.CharField(required=False)
    shipment_ids = serializers.ListField(child=serializers.CharField(), required=False)
    event_type = serializers.ChoiceField(choices=['pickup', 'delivery'], required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    def validate(self, data):
        data['session_id'] = data.get('session_id')
        data['shipment_ids'] = data.get('shipment_ids')
        data['event_type'] = data.get('event_type')
        
        required = ['session_id', 'shipment_ids', 'event_type']
        for field in required:
            if not data.get(field):
                raise serializers.ValidationError({field: 'This field is required.'})
        
        return data





