"""
Serializers for authentication
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import RiderAccount, Homebase, RiderHomebaseAssignment

User = get_user_model()


class HomebaseSerializer(serializers.ModelSerializer):
    """Homebase serializer"""
    
    class Meta:
        model = Homebase
        fields = [
            'id', 'pops_homebase_id', 'name', 'homebase_id', 'aggregator_id',
            'location', 'address', 'city', 'state', 'pincode',
            'latitude', 'longitude', 'is_active', 'capacity',
            'synced_from_pops', 'last_synced_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RiderHomebaseAssignmentSerializer(serializers.ModelSerializer):
    """Rider homebase assignment serializer"""
    homebase_name = serializers.ReadOnlyField(source='homebase.name')
    homebase_code = serializers.ReadOnlyField(source='homebase.homebase_id')
    
    class Meta:
        model = RiderHomebaseAssignment
        fields = [
            'id', 'rider', 'homebase', 'homebase_name', 'homebase_code',
            'is_primary', 'is_active', 'pops_rider_id', 'synced_to_pops',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    """User serializer - username is the primary identifier"""
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name',
            'role', 'is_active', 'is_staff', 'is_superuser',
            'is_ops_team', 'is_deliveryq', 'pia_access',
            'auth_source', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RiderAccountSerializer(serializers.ModelSerializer):
    """Rider account serializer"""
    password = serializers.CharField(write_only=True, required=False)
    is_super_user = serializers.SerializerMethodField()  # Always return False for riders
    
    primary_homebase_details = HomebaseSerializer(source='primary_homebase', read_only=True)
    homebase_assignments = RiderHomebaseAssignmentSerializer(source='riderhomebaseassignment_set', many=True, read_only=True)
    
    class Meta:
        model = RiderAccount
        fields = [
            'id', 'rider_id', 'full_name', 'email', 'rider_type', 'dispatch_option',
            'primary_homebase', 'primary_homebase_details', 'homebase_assignments',
            'is_active', 'is_approved', 'is_rider', 'is_super_user',
            'pops_rider_id', 'synced_to_pops', 'password',
            'last_login_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'pops_rider_id', 'synced_to_pops', 'created_at', 'updated_at', 'is_super_user']
    
    def get_is_super_user(self, obj):
        """Riders should NEVER have superuser permissions"""
        return False
    
    def create(self, validated_data):
        """Create rider account with bcrypt password hashing"""
        import bcrypt
        password = validated_data.pop('password', None)
        if password:
            password_bytes = password.encode('utf-8')
            salt = bcrypt.gensalt()
            password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
            validated_data['password_hash'] = password_hash
        # Ensure riders never get superuser permissions
        validated_data.pop('is_super_user', None)  # Remove if present
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update rider account - ensure is_super_user is never set to True"""
        # Remove is_super_user from validated_data if present
        validated_data.pop('is_super_user', None)
        return super().update(instance, validated_data)


class LoginSerializer(serializers.Serializer):
    """Login serializer - accepts username (email value from estimator)"""
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class LoginResponseSerializer(serializers.Serializer):
    """Login response serializer - matches current Node.js backend format"""
    success = serializers.BooleanField()
    message = serializers.CharField()
    access = serializers.CharField(required=False)
    refresh = serializers.CharField(required=False)
    full_name = serializers.CharField(required=False)
    is_staff = serializers.BooleanField(required=False)
    is_super_user = serializers.BooleanField(required=False)
    is_ops_team = serializers.BooleanField(required=False)
    username = serializers.CharField(required=False)






