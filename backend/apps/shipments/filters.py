"""
Filters for shipments
"""
import django_filters
from .models import Shipment


class ShipmentFilter(django_filters.FilterSet):
    """Filter for shipments"""
    status = django_filters.CharFilter(field_name='status', lookup_expr='iexact')  # Keep exact for status dropdown
    type = django_filters.CharFilter(field_name='type', lookup_expr='iexact')  # Keep exact for type dropdown
    employee_id = django_filters.CharFilter(field_name='employee_id', lookup_expr='icontains')  # Partial match for rider ID
    route_name = django_filters.CharFilter(field_name='route_name', lookup_expr='icontains')  # Already partial
    sync_status = django_filters.CharFilter(field_name='sync_status', lookup_expr='iexact')  # Keep exact for sync status
    pops_order_id = django_filters.CharFilter(field_name='pops_order_id', lookup_expr='icontains')  # Partial match for order ID
    created_at__gte = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_at__lte = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    delivery_time__gte = django_filters.DateTimeFilter(field_name='delivery_time', lookup_expr='gte')
    delivery_time__lte = django_filters.DateTimeFilter(field_name='delivery_time', lookup_expr='lte')
    
    class Meta:
        model = Shipment
        fields = ['status', 'type', 'employee_id', 'route_name', 'sync_status', 'pops_order_id']
