"""
Serializers for vehicles app
"""
from rest_framework import serializers
from .models import VehicleType, FuelSetting


class VehicleTypeSerializer(serializers.ModelSerializer):
    """Vehicle type serializer"""
    id = serializers.CharField(required=False, allow_blank=True)  # Allow auto-generation
    
    fuelEfficiency = serializers.FloatField(source='fuel_efficiency')
    co2Emissions = serializers.FloatField(source='co2_emissions')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = VehicleType
        fields = [
            'id', 'name', 'fuel_efficiency', 'description', 'icon',
            'fuel_type', 'co2_emissions', 'created_at', 'updated_at',
            # Aliases
            'fuelEfficiency', 'co2Emissions', 'createdAt', 'updatedAt'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        """Create vehicle type with auto-generated ID if not provided"""
        if not validated_data.get('id'):
            # Generate ID from name (sanitized)
            import uuid
            name = validated_data.get('name', 'vehicle')
            sanitized_name = ''.join(c if c.isalnum() or c in '-_' else '_' for c in name.lower())
            validated_data['id'] = f"{sanitized_name}_{str(uuid.uuid4())[:8]}"
        return super().create(validated_data)


class FuelSettingSerializer(serializers.ModelSerializer):
    """Fuel setting serializer"""
    id = serializers.CharField(required=False, allow_blank=True)  # Allow auto-generation
    
    fuelType = serializers.CharField(source='fuel_type')
    pricePerLiter = serializers.FloatField(source='price_per_liter')
    effectiveDate = serializers.DateTimeField(source='effective_date')
    isActive = serializers.BooleanField(source='is_active')
    createdBy = serializers.CharField(source='created_by')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = FuelSetting
        fields = [
            'id', 'fuel_type', 'price_per_liter', 'currency', 'region',
            'effective_date', 'is_active', 'created_by', 'created_at', 'updated_at',
            # Aliases
            'fuelType', 'pricePerLiter', 'effectiveDate', 'isActive', 'createdBy', 'createdAt', 'updatedAt'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        """Create fuel setting with auto-generated ID if not provided"""
        if not validated_data.get('id'):
            # Generate ID from fuel_type and region
            import uuid
            fuel_type = validated_data.get('fuel_type', 'fuel')
            region = validated_data.get('region', 'default')
            validated_data['id'] = f"{fuel_type}_{region}_{str(uuid.uuid4())[:8]}"
        return super().create(validated_data)






