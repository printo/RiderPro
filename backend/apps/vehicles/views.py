"""
Views for vehicles app
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiExample
from .models import VehicleType, FuelSetting
from .serializers import VehicleTypeSerializer, FuelSettingSerializer


@extend_schema(
    tags=['Vehicles'],
    examples=[
        OpenApiExample(
            'Create vehicle type (form)',
            value={'name': 'Bike', 'description': 'Two-wheeler for urban deliveries'},
            request_only=True,
            media_type='application/x-www-form-urlencoded',
        ),
        OpenApiExample(
            'Vehicle type response',
            value={'id': 1, 'name': 'Bike', 'description': 'Two-wheeler for urban deliveries'},
            response_only=True,
            status_codes=['200', '201'],
        ),
    ],
)
class VehicleTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for vehicle types — CRUD operations on vehicle categories (Bike, Auto, 3PL)."""
    queryset = VehicleType.objects.all()
    serializer_class = VehicleTypeSerializer
    permission_classes = [IsAuthenticated]


@extend_schema(
    tags=['Vehicles'],
    examples=[
        OpenApiExample(
            'Create fuel setting (form)',
            value={'vehicle_type': 1, 'rate_per_km': '4.50', 'effective_from': '2024-01-01'},
            request_only=True,
            media_type='application/x-www-form-urlencoded',
        ),
        OpenApiExample(
            'Fuel setting response',
            value={'id': 1, 'vehicle_type': 1, 'rate_per_km': '4.50', 'effective_from': '2024-01-01'},
            response_only=True,
            status_codes=['200', '201'],
        ),
    ],
)
class FuelSettingViewSet(viewsets.ModelViewSet):
    """ViewSet for fuel/rate settings per vehicle type."""
    queryset = FuelSetting.objects.all()
    serializer_class = FuelSettingSerializer
    permission_classes = [IsAuthenticated]
