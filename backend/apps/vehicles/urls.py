"""
URLs for vehicles app
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VehicleTypeViewSet, FuelSettingViewSet

router = DefaultRouter()
router.register(r'vehicle-types', VehicleTypeViewSet, basename='vehicle-type')
router.register(r'fuel-settings', FuelSettingViewSet, basename='fuel-setting')

urlpatterns = [
    path('', include(router.urls)),
]






