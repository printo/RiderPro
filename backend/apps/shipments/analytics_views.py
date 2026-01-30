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
    employee_id = request.query_params.get('employeeId')
    start_date = request.query_params.get('startDate')
    end_date = request.query_params.get('endDate')
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
        totalDistance=Sum('total_distance'),
        totalTime=Sum('total_time'),
        averageSpeed=Avg('average_speed'),
        fuelConsumed=Sum('fuel_consumed'),
        fuelCost=Sum('fuel_cost'),
        shipmentsCompleted=Sum('shipments_completed')
    ).order_by('-date')
    
    # Calculate efficiency (distance per shipment)
    result = []
    for item in analytics:
        efficiency = 0
        if item['shipmentsCompleted'] and item['shipmentsCompleted'] > 0:
            efficiency = (item['totalDistance'] or 0) / item['shipmentsCompleted']
        
        result.append({
            'employeeId': item['employee_id'],
            'date': item['date'].isoformat() if item['date'] else None,
            'totalDistance': float(item['totalDistance'] or 0),
            'totalTime': int(item['totalTime'] or 0),
            'averageSpeed': float(item['averageSpeed'] or 0),
            'fuelConsumed': float(item['fuelConsumed'] or 0),
            'fuelCost': float(item['fuelCost'] or 0),
            'shipmentsCompleted': int(item['shipmentsCompleted'] or 0),
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
    employee_id = request.query_params.get('employeeId')
    start_date = request.query_params.get('startDate')
    end_date = request.query_params.get('endDate')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    metrics = queryset.values('employee_id').annotate(
        totalSessions=Count('id'),
        totalDistance=Sum('total_distance'),
        totalTime=Sum('total_time'),
        averageSpeed=Avg('average_speed'),
        fuelConsumed=Sum('fuel_consumed'),
        fuelCost=Sum('fuel_cost'),
        shipmentsCompleted=Sum('shipments_completed')
    ).order_by('-shipmentsCompleted')
    
    result = []
    for item in metrics:
        result.append({
            'employeeId': item['employee_id'],
            'totalSessions': item['totalSessions'],
            'totalDistance': float(item['totalDistance'] or 0),
            'totalTime': int(item['totalTime'] or 0),
            'averageSpeed': float(item['averageSpeed'] or 0),
            'fuelConsumed': float(item['fuelConsumed'] or 0),
            'fuelCost': float(item['fuelCost'] or 0),
            'shipmentsCompleted': int(item['shipmentsCompleted'] or 0)
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
    employee_id = request.query_params.get('employeeId')
    start_date = request.query_params.get('startDate')
    end_date = request.query_params.get('endDate')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    metrics = queryset.aggregate(
        totalSessions=Count('id'),
        totalDistance=Sum('total_distance'),
        totalTime=Sum('total_time'),
        averageSpeed=Avg('average_speed'),
        fuelConsumed=Sum('fuel_consumed'),
        fuelCost=Sum('fuel_cost'),
        shipmentsCompleted=Sum('shipments_completed')
    )
    
    return Response({
        'success': True,
        'metrics': [{
            'totalSessions': metrics['totalSessions'] or 0,
            'totalDistance': float(metrics['totalDistance'] or 0),
            'totalTime': int(metrics['totalTime'] or 0),
            'averageSpeed': float(metrics['averageSpeed'] or 0),
            'fuelConsumed': float(metrics['fuelConsumed'] or 0),
            'fuelCost': float(metrics['fuelCost'] or 0),
            'shipmentsCompleted': int(metrics['shipmentsCompleted'] or 0)
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
    employee_id = request.query_params.get('employeeId')
    start_date = request.query_params.get('startDate')
    end_date = request.query_params.get('endDate')
    
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
        totalSessions=Count('id'),
        totalDistance=Sum('total_distance'),
        totalTime=Sum('total_time'),
        averageSpeed=Avg('average_speed'),
        fuelConsumed=Sum('fuel_consumed'),
        fuelCost=Sum('fuel_cost'),
        shipmentsCompleted=Sum('shipments_completed')
    ).order_by('period')
    
    result = []
    for item in metrics:
        result.append({
            'period': item['period'].isoformat() if item['period'] else None,
            'totalSessions': item['totalSessions'],
            'totalDistance': float(item['totalDistance'] or 0),
            'totalTime': int(item['totalTime'] or 0),
            'averageSpeed': float(item['averageSpeed'] or 0),
            'fuelConsumed': float(item['fuelConsumed'] or 0),
            'fuelCost': float(item['fuelCost'] or 0),
            'shipmentsCompleted': int(item['shipmentsCompleted'] or 0)
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
    employee_id = request.query_params.get('employeeId')
    start_date = request.query_params.get('startDate')
    end_date = request.query_params.get('endDate')
    
    queryset = RouteSession.objects.all()
    
    if employee_id:
        queryset = queryset.filter(employee_id=employee_id)
    elif not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    metrics = queryset.aggregate(
        totalFuelConsumed=Sum('fuel_consumed'),
        totalFuelCost=Sum('fuel_cost'),
        totalDistance=Sum('total_distance'),
        averageEfficiency=Avg('average_speed')  # Simplified - would need proper fuel efficiency calculation
    )
    
    total_fuel = float(metrics['totalFuelConsumed'] or 0)
    total_distance = float(metrics['totalDistance'] or 0)
    fuel_per_km = 0
    if total_distance > 0:
        fuel_per_km = total_fuel / total_distance
    
    return Response({
        'success': True,
        'analytics': {
            'totalFuelConsumed': total_fuel,
            'totalFuelCost': float(metrics['totalFuelCost'] or 0),
            'totalDistance': total_distance,
            'averageEfficiency': float(metrics['averageEfficiency'] or 0),
            'fuelPerKm': fuel_per_km
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
    start_date = request.query_params.get('startDate')
    end_date = request.query_params.get('endDate')
    
    queryset = RouteSession.objects.all()
    
    if not (user.is_superuser or user.is_ops_team or user.is_staff):
        if user.employee_id:
            queryset = queryset.filter(employee_id=user.employee_id)
    
    if start_date and end_date:
        queryset = queryset.filter(start_time__date__gte=start_date, start_time__date__lte=end_date)
    
    # Group by employee and calculate metrics
    employees = queryset.values('employee_id').annotate(
        totalDistance=Sum('total_distance'),
        totalTime=Sum('total_time'),
        shipmentsCompleted=Sum('shipments_completed'),
        fuelConsumed=Sum('fuel_consumed')
    )
    
    # Calculate efficiency
    result = []
    for emp in employees:
        efficiency = 0
        if emp['shipmentsCompleted'] and emp['shipmentsCompleted'] > 0:
            efficiency = (emp['totalDistance'] or 0) / emp['shipmentsCompleted']
        
        result.append({
            'employeeId': emp['employee_id'],
            'distance': float(emp['totalDistance'] or 0),
            'efficiency': efficiency,
            'fuel': float(emp['fuelConsumed'] or 0),
            'shipments': int(emp['shipmentsCompleted'] or 0)
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
    employee_id = request.query_params.get('employeeId')
    start_date = request.query_params.get('startDate')
    end_date = request.query_params.get('endDate')
    
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
        totalDistance=Sum('total_distance'),
        shipmentsCompleted=Sum('shipments_completed')
    ).order_by('hour')
    
    result = []
    for item in hourly:
        result.append({
            'hour': item['hour'].isoformat() if item['hour'] else None,
            'count': item['count'],
            'totalDistance': float(item['totalDistance'] or 0),
            'shipmentsCompleted': int(item['shipmentsCompleted'] or 0)
        })
    
    return Response({
        'success': True,
        'activity': result
    })

