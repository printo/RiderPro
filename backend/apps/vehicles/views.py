"""
Views for vehicles app
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import VehicleType, FuelSetting
from .serializers import VehicleTypeSerializer, FuelSettingSerializer


class VehicleTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for vehicle types"""
    queryset = VehicleType.objects.all()
    serializer_class = VehicleTypeSerializer
    permission_classes = [IsAuthenticated]


class FuelSettingViewSet(viewsets.ModelViewSet):
    """ViewSet for fuel settings"""
    queryset = FuelSetting.objects.all()
    serializer_class = FuelSettingSerializer
    permission_classes = [IsAuthenticated]
