"""
URLs for sync app
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SyncViewSet

router = DefaultRouter()
router.register(r'sync', SyncViewSet, basename='sync')

urlpatterns = [
    path('', include(router.urls)),
]






