"""
Serializers for routes app
"""
from rest_framework import serializers
from .models import RouteSession, RouteTracking


class RouteSessionSerializer(serializers.ModelSerializer):
    """Route session serializer"""
    tracking_points = serializers.SerializerMethodField()
    
    # CamelCase aliases for frontend
    employeeId = serializers.CharField(source='employee_id', read_only=True)
    startTime = serializers.DateTimeField(source='start_time', read_only=True)
    endTime = serializers.DateTimeField(source='end_time', read_only=True)
    startLatitude = serializers.FloatField(source='start_latitude', read_only=True)
    startLongitude = serializers.FloatField(source='start_longitude', read_only=True)
    endLatitude = serializers.FloatField(source='end_latitude', read_only=True)
    endLongitude = serializers.FloatField(source='end_longitude', read_only=True)
    currentLatitude = serializers.FloatField(source='current_latitude', read_only=True)
    currentLongitude = serializers.FloatField(source='current_longitude', read_only=True)
    lastUpdated = serializers.DateTimeField(source='last_updated', read_only=True)
    totalDistance = serializers.FloatField(source='total_distance', read_only=True)
    totalTime = serializers.IntegerField(source='total_time', read_only=True)
    shipmentsCompleted = serializers.IntegerField(source='shipments_completed', read_only=True)
    shipmentId = serializers.CharField(source='shipment_id', read_only=True)
    riderStatus = serializers.SerializerMethodField()

    class Meta:
        model = RouteSession
        fields = [
            'id', 'employee_id', 'start_time', 'end_time', 'status',
            'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
            'current_latitude', 'current_longitude', 'last_updated',
            'total_distance', 'total_time', 'fuel_consumed', 'fuel_cost',
            'average_speed', 'shipments_completed', 'shipment_id',
            'created_at', 'updated_at', 'tracking_points',
            # Aliases
            'employeeId', 'startTime', 'endTime', 'startLatitude', 'startLongitude',
            'endLatitude', 'endLongitude', 'currentLatitude', 'currentLongitude',
            'lastUpdated', 'totalDistance', 'totalTime', 'shipmentsCompleted', 'shipmentId',
            'riderStatus', 'rider_status'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    @property
    def rider_status(self):
        """Standard property for use in templates if needed"""
        return self.get_rider_status(self.instance)

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
    
    # CamelCase aliases
    employeeId = serializers.CharField(source='employee_id', read_only=True)
    shipmentId = serializers.CharField(source='shipment_id', read_only=True)
    eventType = serializers.CharField(source='event_type', read_only=True)

    class Meta:
        model = RouteTracking
        fields = [
            'id', 'session', 'employee_id', 'latitude', 'longitude',
            'timestamp', 'date', 'accuracy', 'speed', 'event_type',
            'shipment_id', 'fuel_efficiency', 'fuel_price',
            # Aliases
            'employeeId', 'shipmentId', 'eventType'
        ]
        read_only_fields = ['id', 'date']


class RouteSessionCreateSerializer(serializers.Serializer):
    """Serializer for creating route session"""
    start_latitude = serializers.FloatField(required=False)
    start_longitude = serializers.FloatField(required=False)
    startLatitude = serializers.FloatField(required=False)
    startLongitude = serializers.FloatField(required=False)
    shipment_id = serializers.CharField(required=False, allow_null=True)
    shipmentId = serializers.CharField(required=False, allow_null=True)

    def validate(self, data):
        data['start_latitude'] = data.get('start_latitude') or data.get('startLatitude')
        data['start_longitude'] = data.get('start_longitude') or data.get('startLongitude')
        data['shipment_id'] = data.get('shipment_id') or data.get('shipmentId')
        
        if data.get('start_latitude') is None or data.get('start_longitude') is None:
            raise serializers.ValidationError('Start location is required.')
            
        # Cleanup
        for k in ['startLatitude', 'startLongitude', 'shipmentId']:
            if k in data: del data[k]
        return data


class RouteSessionStopSerializer(serializers.Serializer):
    """Serializer for stopping route session"""
    session_id = serializers.CharField(required=False)
    sessionId = serializers.CharField(required=False)
    end_latitude = serializers.FloatField(required=False)
    end_longitude = serializers.FloatField(required=False)
    endLatitude = serializers.FloatField(required=False)
    endLongitude = serializers.FloatField(required=False)

    def validate(self, data):
        data['session_id'] = data.get('session_id') or data.get('sessionId')
        data['end_latitude'] = data.get('end_latitude') or data.get('endLatitude')
        data['end_longitude'] = data.get('end_longitude') or data.get('endLongitude')
        
        required = ['session_id', 'end_latitude', 'end_longitude']
        for field in required:
            if data.get(field) is None:
                raise serializers.ValidationError({field: 'This field is required.'})
                
        # Cleanup
        for k in ['sessionId', 'endLatitude', 'endLongitude']:
            if k in data: del data[k]
        return data


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
        session_id = data.get('session_id') or data.get('sessionId')
        if not session_id:
            raise serializers.ValidationError({'session_id': 'This field is required.'})
        data['session_id'] = session_id
        if 'sessionId' in data:
            del data['sessionId']
        return data


class RouteLocationSerializer(serializers.Serializer):
    """Simple location serializer for optimization"""
    id = serializers.CharField(required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    shipment_id = serializers.CharField(required=False)
    shipmentId = serializers.CharField(required=False)

    def validate(self, data):
        if 'shipmentId' in data:
            data['shipment_id'] = data.pop('shipmentId')
        return data


class RouteOptimizeRequestSerializer(serializers.Serializer):
    """Serializer for route optimization request"""
    current_latitude = serializers.FloatField(required=False)
    current_longitude = serializers.FloatField(required=False)
    currentLatitude = serializers.FloatField(required=False)
    currentLongitude = serializers.FloatField(required=False)
    locations = RouteLocationSerializer(many=True)

    def validate(self, data):
        data['current_latitude'] = data.get('current_latitude') or data.get('currentLatitude')
        data['current_longitude'] = data.get('current_longitude') or data.get('currentLongitude')
        
        if data.get('current_latitude') is None or data.get('current_longitude') is None:
             raise serializers.ValidationError('Current location is required.')
             
        # Cleanup
        if 'currentLatitude' in data: del data['currentLatitude']
        if 'currentLongitude' in data: del data['currentLongitude']
        return data


class ShipmentEventSerializer(serializers.Serializer):
    """Serializer for shipment event"""
    session_id = serializers.CharField(required=False)
    sessionId = serializers.CharField(required=False)
    shipment_id = serializers.CharField(required=False)
    shipmentId = serializers.CharField(required=False)
    event_type = serializers.ChoiceField(choices=['pickup', 'delivery'], required=False)
    eventType = serializers.ChoiceField(choices=['pickup', 'delivery'], required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    def validate(self, data):
        """Normalize fields from camelCase or snake_case"""
        data['session_id'] = data.get('session_id') or data.get('sessionId')
        data['shipment_id'] = data.get('shipment_id') or data.get('shipmentId')
        data['event_type'] = data.get('event_type') or data.get('eventType')
        
        required = ['session_id', 'shipment_id', 'event_type']
        for field in required:
            if not data.get(field):
                raise serializers.ValidationError({field: 'This field is required.'})
        
        # Cleanup
        for k in ['sessionId', 'shipmentId', 'eventType']:
            if k in data: del data[k]
        return data


class BulkShipmentEventSerializer(serializers.Serializer):
    """Serializer for bulk shipment events at one location"""
    session_id = serializers.CharField(required=False)
    sessionId = serializers.CharField(required=False)
    shipment_ids = serializers.ListField(child=serializers.CharField(), required=False)
    shipmentIds = serializers.ListField(child=serializers.CharField(), required=False)
    event_type = serializers.ChoiceField(choices=['pickup', 'delivery'], required=False)
    eventType = serializers.ChoiceField(choices=['pickup', 'delivery'], required=False)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    def validate(self, data):
        """Normalize fields from camelCase or snake_case"""
        data['session_id'] = data.get('session_id') or data.get('sessionId')
        data['shipment_ids'] = data.get('shipment_ids') or data.get('shipmentIds')
        data['event_type'] = data.get('event_type') or data.get('eventType')
        
        required = ['session_id', 'shipment_ids', 'event_type']
        for field in required:
            if not data.get(field):
                raise serializers.ValidationError({field: 'This field is required.'})
        
        # Cleanup
        for k in ['sessionId', 'shipmentIds', 'eventType']:
            if k in data: del data[k]
        return data






