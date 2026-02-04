"""
API Source Analytics for Shipments
Provides insights into which API sources are sending shipments
"""
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Shipment


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_source_analytics(request):
    """
    Get analytics about shipments by API source
    
    Query parameters:
    - days: Number of days to look back (default: 30)
    - include_null: Include shipments with no API source (default: true)
    """
    try:
        # Get query parameters
        days = int(request.GET.get('days', 30))
        include_null = request.GET.get('include_null', 'true').lower() == 'true'
        
        # Calculate date range
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Base queryset
        queryset = Shipment.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        
        # Get shipments by API source
        if include_null:
            source_stats = queryset.values('api_source').annotate(
                count=Count('id')
            ).order_by('-count')
        else:
            source_stats = queryset.exclude(
                Q(api_source__isnull=True) | Q(api_source='')
            ).values('api_source').annotate(
                count=Count('id')
            ).order_by('-count')
        
        # Get total counts
        total_shipments = queryset.count()
        shipments_with_source = queryset.exclude(
            Q(api_source__isnull=True) | Q(api_source='')
        ).count()
        shipments_without_source = total_shipments - shipments_with_source
        
        # Format the data
        source_breakdown = []
        for stat in source_stats:
            source_name = stat['api_source'] or 'Unknown/Legacy'
            source_breakdown.append({
                'source': source_name,
                'count': stat['count'],
                'percentage': round((stat['count'] / total_shipments) * 100, 2) if total_shipments > 0 else 0
            })
        
        # Get status breakdown by source
        status_by_source = {}
        for source_stat in source_stats:
            source = source_stat['api_source'] or 'Unknown/Legacy'
            if source == 'Unknown/Legacy':
                source_filter = Q(api_source__isnull=True) | Q(api_source='')
            else:
                source_filter = Q(api_source=source_stat['api_source'])
                
            status_breakdown = queryset.filter(source_filter).values('status').annotate(
                count=Count('id')
            ).order_by('-count')
            
            status_by_source[source] = [
                {
                    'status': s['status'],
                    'count': s['count']
                } for s in status_breakdown
            ]
        
        return Response({
            'success': True,
            'data': {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': days
                },
                'summary': {
                    'total_shipments': total_shipments,
                    'shipments_with_source': shipments_with_source,
                    'shipments_without_source': shipments_without_source,
                    'source_tracking_percentage': round((shipments_with_source / total_shipments) * 100, 2) if total_shipments > 0 else 0
                },
                'source_breakdown': source_breakdown,
                'status_by_source': status_by_source
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_source_timeline(request):
    """
    Get timeline of shipments by API source
    
    Query parameters:
    - days: Number of days to look back (default: 7)
    - source: Filter by specific API source (optional)
    """
    try:
        from django.db.models import Count
        from django.db.models.functions import TruncDate
        
        # Get query parameters
        days = int(request.GET.get('days', 7))
        source_filter = request.GET.get('source')
        
        # Calculate date range
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Base queryset
        queryset = Shipment.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        
        # Apply source filter if provided
        if source_filter:
            if source_filter.lower() == 'unknown' or source_filter.lower() == 'legacy':
                queryset = queryset.filter(Q(api_source__isnull=True) | Q(api_source=''))
            else:
                queryset = queryset.filter(api_source=source_filter)
        
        # Get daily counts
        daily_counts = queryset.annotate(
            date=TruncDate('created_at')
        ).values('date', 'api_source').annotate(
            count=Count('id')
        ).order_by('date', 'api_source')
        
        # Format the data
        timeline_data = {}
        for item in daily_counts:
            date_str = item['date'].isoformat()
            source = item['api_source'] or 'Unknown/Legacy'
            
            if date_str not in timeline_data:
                timeline_data[date_str] = {}
            
            timeline_data[date_str][source] = item['count']
        
        return Response({
            'success': True,
            'data': {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': days
                },
                'source_filter': source_filter,
                'timeline': timeline_data
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)