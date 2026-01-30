"""
Serializers for authentication
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import RiderAccount

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'employee_id', 'full_name',
            'role', 'is_active', 'is_staff', 'is_superuser',
            'is_ops_team', 'is_deliveryq', 'pia_access',
            'auth_source', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RiderAccountSerializer(serializers.ModelSerializer):
    """Rider account serializer"""
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = RiderAccount
        fields = [
            'id', 'rider_id', 'full_name', 'email', 'rider_type',
            'is_active', 'is_approved', 'is_rider', 'is_super_user',
            'role', 'pops_rider_id', 'synced_to_pops',
            'last_login_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'pops_rider_id', 'synced_to_pops', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """Create rider account with bcrypt password hashing"""
        import bcrypt
        password = validated_data.pop('password', None)
        if password:
            password_bytes = password.encode('utf-8')
            salt = bcrypt.gensalt()
            password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
            validated_data['password_hash'] = password_hash
        return super().create(validated_data)


class LoginSerializer(serializers.Serializer):
    """Login serializer - accepts email or rider_id"""
    email = serializers.CharField(required=True)
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
    employee_id = serializers.CharField(required=False)






