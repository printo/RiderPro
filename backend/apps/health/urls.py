"""
URLs for health app
"""
from django.urls import path
from .views import health_check, api_status, log_error

urlpatterns = [
    path('health', health_check, name='health'),
    path('api-status', api_status, name='api-status'),
    path('errors', log_error, name='log-error'),
]

