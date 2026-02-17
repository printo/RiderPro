"""
Analytics views for route and employee performance
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q, Count, Avg, Sum, F, Max, Min
from django.db.models.functions import TruncDate, TruncHour, TruncDay, TruncWeek, TruncMonth
from django.utils import timezone
from datetime import datetime, timedelta
from .models import RouteSession, RouteTracking

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def route_analytics(request):
    """
    Get route analytics - matches /api/routes/analytics from Node.js
    Returns analytics grouped by employee and date
    """
    user = request.user
    employee_id = request.query_params.get('employee_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    date = request.query_params.get('date')
    
    # Build query
    queryset = RouteSession.objects.all()
    
    # Filter by employee
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        # Non-admin users can only see their own data
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    # Filter by date
    if date:
        queryset = queryset.filter(start_time__date=date)
    elif start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    # Group by employee_id and date, calculate metrics
    analytics = queryset.values('employee_id', date=TruncDate('start_time')).annotate(
        total_distance=Sum('total_distance'),
        total_time=Sum('total_time'),
        average_speed=Avg('average_speed'),
        fuel_consumed=Sum('fuel_consumed'),
        fuel_cost=Sum('fuel_cost'),
        shipments_completed=Sum('shipments_completed')
    ).order_by('-date')
    
    # Calculate efficiency (distance per shipment)
    result = []
    for item in analytics:
        efficiency = 0
        if item['shipments_completed'] and item['shipments_completed'] > 0:
            efficiency = (item['total_distance'] or 0) / item['shipments_completed']
        
        result.append({
            'employee_id': item['employee_id'],
            'date': item['date'].isoformat() if item['date'] else None,
            'total_distance': float(item['total_distance'] or 0),
            'total_time': int(item['total_time'] or 0),
            'average_speed': float(item['average_speed'] or 0),
            'fuel_consumed': float(item['fuel_consumed'] or 0),
            'fuel_cost': float(item['fuel_cost'] or 0),
            'shipments_completed': int(item['shipments_completed'] or 0),
            'efficiency': efficiency
        })
    
    return Response({
        'success': True,
        'analytics': result
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_analytics(request):
    """
    Get employee performance metrics - matches /api/analytics/employees
    """
    user = request.user
    employee_id = request.query_params.get('employee_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    metrics = queryset.values('employee_id').annotate(
        total_sessions=Count('id'),
        total_distance=Sum('total_distance'),
        total_time=Sum('total_time'),
        average_speed=Avg('average_speed'),
        fuel_consumed=Sum('fuel_consumed'),
        fuel_cost=Sum('fuel_cost'),
        shipments_completed=Sum('shipments_completed')
    ).order_by('-shipments_completed')
    
    result = []
    for item in metrics:
        result.append({
            'employee_id': item['employee_id'],
            'total_sessions': item['total_sessions'],
            'total_distance': float(item['total_distance'] or 0),
            'total_time': int(item['total_time'] or 0),
            'average_speed': float(item['average_speed'] or 0),
            'fuel_consumed': float(item['fuel_consumed'] or 0),
            'fuel_cost': float(item['fuel_cost'] or 0),
            'shipments_completed': int(item['shipments_completed'] or 0)
        })
    
    return Response({
        'success': True,
        'metrics': result
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def route_metrics(request):
    """
    Get route performance metrics - matches /api/analytics/routes
    """
    user = request.user
    employee_id = request.query_params.get('employee_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    metrics = queryset.aggregate(
        total_sessions=Count('id'),
        total_distance=Sum('total_distance'),
        total_time=Sum('total_time'),
        average_speed=Avg('average_speed'),
        fuel_consumed=Sum('fuel_consumed'),
        fuel_cost=Sum('fuel_cost'),
        shipments_completed=Sum('shipments_completed')
    )
    
    return Response({
        'success': True,
        'metrics': [{
            'total_sessions': metrics['total_sessions'] or 0,
            'total_distance': float(metrics['total_distance'] or 0),
            'total_time': int(metrics['total_time'] or 0),
            'average_speed': float(metrics['average_speed'] or 0),
            'fuel_consumed': float(metrics['fuel_consumed'] or 0),
            'fuel_cost': float(metrics['fuel_cost'] or 0),
            'shipments_completed': int(metrics['shipments_completed'] or 0)
        }]
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def time_based_analytics(request, group_by):
    """
    Get time-based analytics - matches /api/analytics/time/{groupBy}
    groupBy can be: day, week, month
    """
    user = request.user
    employee_id = request.query_params.get('employee_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    # Group by time period
    if group_by == 'day':
        trunc = TruncDay('start_time')
    elif group_by == 'week':
        trunc = TruncWeek('start_time')
    elif group_by == 'month':
        trunc = TruncMonth('start_time')
    else:
        trunc = TruncDay('start_time')
    
    metrics = queryset.annotate(period=trunc).values('period').annotate(
        total_sessions=Count('id'),
        total_distance=Sum('total_distance'),
        total_time=Sum('total_time'),
        average_speed=Avg('average_speed'),
        fuel_consumed=Sum('fuel_consumed'),
        fuel_cost=Sum('fuel_cost'),
        shipments_completed=Sum('shipments_completed')
    ).order_by('period')
    
    result = []
    for item in metrics:
        result.append({
            'period': item['period'].isoformat() if item['period'] else None,
            'total_sessions': item['total_sessions'],
            'total_distance': float(item['total_distance'] or 0),
            'total_time': int(item['total_time'] or 0),
            'average_speed': float(item['average_speed'] or 0),
            'fuel_consumed': float(item['fuel_consumed'] or 0),
            'fuel_cost': float(item['fuel_cost'] or 0),
            'shipments_completed': int(item['shipments_completed'] or 0)
        })
    
    return Response({
        'success': True,
        'metrics': result
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fuel_analytics(request):
    """
    Get fuel analytics - matches /api/analytics/fuel
    """
    user = request.user
    employee_id = request.query_params.get('employee_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    metrics = queryset.aggregate(
        total_fuel_consumed=Sum('fuel_consumed'),
        total_fuel_cost=Sum('fuel_cost'),
        total_distance=Sum('total_distance'),
        average_efficiency=Avg('average_speed')
    )
    
    total_fuel = float(metrics['total_fuel_consumed'] or 0)
    total_distance = float(metrics['total_distance'] or 0)
    fuel_per_km = 0
    if total_distance > 0:
        fuel_per_km = total_fuel / total_distance
    
    return Response({
        'success': True,
        'analytics': {
            'total_fuel_consumed': total_fuel,
            'total_fuel_cost': float(metrics['total_fuel_cost'] or 0),
            'total_distance': total_distance,
            'average_efficiency': float(metrics['average_efficiency'] or 0),
            'fuel_per_km': fuel_per_km
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_performers(request, metric):
    """
    Get top performers - matches /api/analytics/top-performers/{metric}
    metric can be: distance, efficiency, fuel, shipments
    """
    user = request.user
    limit = int(request.query_params.get('limit', 10))
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    queryset = RouteSession.objects.all()
    
    if not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    # Group by employee and calculate metrics
    employees = queryset.values('employee_id').annotate(
        total_distance=Sum('total_distance'),
        total_time=Sum('total_time'),
        shipments_completed=Sum('shipments_completed'),
        fuel_consumed=Sum('fuel_consumed')
    )
    
    # Calculate efficiency
    result = []
    for emp in employees:
        efficiency = 0
        if emp['shipments_completed'] and emp['shipments_completed'] > 0:
            efficiency = (emp['total_distance'] or 0) / emp['shipments_completed']
        
        result.append({
            'employee_id': emp['employee_id'],
            'distance': float(emp['total_distance'] or 0),
            'efficiency': efficiency,
            'fuel': float(emp['fuel_consumed'] or 0),
            'shipments': int(emp['shipments_completed'] or 0)
        })
    
    # Sort by metric
    if metric == 'distance':
        result.sort(key=lambda x: x['distance'], reverse=True)
    elif metric == 'efficiency':
        result.sort(key=lambda x: x['efficiency'], reverse=True)
    elif metric == 'fuel':
        result.sort(key=lambda x: x['fuel'], reverse=True)
    elif metric == 'shipments':
        result.sort(key=lambda x: x['shipments'], reverse=True)
    
    return Response({
        'success': True,
        'performers': result[:limit],
        'metric': metric,
        'count': len(result[:limit])
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hourly_activity(request):
    """
    Get hourly activity - matches /api/analytics/activity/hourly
    """
    user = request.user
    employee_id = request.query_params.get('employee_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    # Group by hour
    hourly = queryset.annotate(hour=TruncHour('start_time')).values('hour').annotate(
        count=Count('id'),
        total_distance=Sum('total_distance'),
        shipments_completed=Sum('shipments_completed')
    ).order_by('hour')
    
    result = []
    for item in hourly:
        result.append({
            'hour': item['hour'].isoformat() if item['hour'] else None,
            'count': item['count'],
            'total_distance': float(item['total_distance'] or 0),
            'shipments_completed': int(item['shipments_completed'] or 0)
        })
    
    return Response({
        'success': True,
        'activity': result
    })
