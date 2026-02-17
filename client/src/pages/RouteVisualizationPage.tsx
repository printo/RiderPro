import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import MetricCard from '@/components/ui/MetricCard';
import { RouteSession, RoutePoint, RouteData, RouteAnalytics, RouteFilters } from '@shared/types';
import {
  Route,
  BarChart3,
  Target,
  Download,
  RefreshCw,
  MapPin,
  Clock
} from 'lucide-react';
import { useMobileOptimization } from '../hooks/useMobileOptimization';
import { useRouteAnalytics } from '../hooks/useRouteAnalytics';
import { useRouteAnalytics as useRouteAnalyticsAPI, useRouteTracking } from '../hooks/useRouteAPI';
import { analyticsApi } from '../apiClient/analytics';

import RouteVisualization from '@/components/routes/RouteVisualization';
import RouteComparison from '@/components/routes/RouteComparison';
import RouteOptimizationSuggestions from '@/components/routes/RouteOptimizationSuggestions';
import RouteDataTable from '@/components/analytics/RouteDataTable';

function RouteVisualizationPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<RouteFilters>({});

  const _mobileOptimization = useMobileOptimization({
    enableGestures: true,
    enableBatteryMonitoring: true,
    enableNetworkMonitoring: true
  });

  // Fetch real route analytics data
  const {
    data: analyticsData = [],
    isLoading: isLoadingAnalytics,
    error: analyticsError,
    refetch: refetchAnalytics
  } = useRouteAnalyticsAPI(filters);

  // Fetch employee metrics for proper names and performance data
  const {
    data: employeeMetrics = [],
    isLoading: isLoadingEmployeeMetrics
  } = useQuery({
    queryKey: ['employee-metrics', filters],
    queryFn: () => analyticsApi.getEmployeeMetrics(filters),
    enabled: true
  });

  // Get aggregated metrics from comprehensive analytics hook
  const {
    dailySummaries,
    getAggregatedMetrics,
    isLoading: isLoadingAdvancedAnalytics,
    refreshAnalytics
  } = useRouteAnalytics(filters);

  // Create employee lookup map for proper names
  const employeeLookup = React.useMemo(() => {
    const map = new Map<string, string>();
    employeeMetrics.forEach((emp: any) => {
      map.set(emp.employee_id, emp.name || `Employee ${emp.employee_id}`);
    });
    return map;
  }, [employeeMetrics]);

  // Convert analytics data to route sessions for visualization
  const routeSessions = React.useMemo(() => {
    return analyticsData.map((analytics, index) => ({
      id: analytics.route_id || `session_${analytics.employee_id}_${index}`,
      employee_id: analytics.employee_id,
      employee_name: employeeLookup.get(analytics.employee_id) || `Employee ${analytics.employee_id}`,
      start_time: new Date().toISOString(), // This would come from session data
      end_time: new Date().toISOString(),
      status: 'completed',
      total_distance: analytics.total_distance,
      total_time: analytics.total_time,
      average_speed: analytics.average_speed,
      points: [], // Would be populated from session coordinates
      shipments_completed: analytics.shipments_completed,
      start_latitude: 0, // Would come from session data
      start_longitude: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as RouteSession));
  }, [analyticsData, employeeLookup]);

  // Convert analytics data to route data format
  const routeData = React.useMemo(() => {
    return analyticsData.map((analytics) => ({
      id: analytics.route_id,
      employee_id: analytics.employee_id,
      employee_name: employeeLookup.get(analytics.employee_id) || `Employee ${analytics.employee_id}`,
      date: analytics.date,
      distance: analytics.total_distance,
      duration: analytics.total_time,
      shipments_completed: analytics.shipments_completed,
      fuel_consumption: analytics.fuel_consumption || analytics.fuel_consumed,
      average_speed: analytics.average_speed,
      efficiency: analytics.efficiency,
      points: [] // Would be populated from coordinate data
    }));
  }, [analyticsData, employeeLookup]);

  const isLoading = isLoadingAnalytics || isLoadingAdvancedAnalytics || isLoadingEmployeeMetrics;
  const lastUpdated = new Date();

  // Get aggregated metrics for summary
  const aggregatedMetrics = getAggregatedMetrics();

  const handleRefreshData = () => {
    // Refresh data from the backend
    refetchAnalytics();
    refreshAnalytics();
  };

  const handleExportData = () => {
    const dataToExport = {
      sessions: routeSessions,
      routeData: routeData,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleImplementSuggestion = (suggestionId: string) => {
    console.log('Implementing suggestion:', suggestionId);
    // In real app, this would trigger the implementation process
  };

  const handleViewRouteDetails = (routeId: string) => {
    setSelectedSessionId(routeId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Loading route data...</span>
          </div>
        </div>
      </div>
    );
  }

  const isMobile = _mobileOptimization.deviceCapabilities.screenSize === 'small';
  const _batteryOptimizations = _mobileOptimization.optimizeForBattery();
  const _networkOptimizations = _mobileOptimization.optimizeForNetwork();

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ${isMobile ? 'mobile-layout' : ''}`}>
      {/* Header */}
      <div className={`${isMobile ? 'flex flex-col space-y-4' : 'flex items-center justify-between'}`}>
        <div>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold`}>
            Route Visualization & Analysis
          </h1>
          <p className="text-gray-600 mt-1">
            {isMobile
              ? 'Analyze routes and get optimization tips'
              : 'Analyze historical routes, compare performance, and get optimization suggestions'
            }
          </p>
        </div>
        <div className={`flex items-center gap-2 ${isMobile ? 'justify-between' : ''}`}>
          <div className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size={isMobile ? "sm" : "sm"}
              onClick={handleRefreshData}
              className={isMobile ? 'min-h-[44px]' : ''}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {isMobile ? '' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              size={isMobile ? "sm" : "sm"}
              onClick={handleExportData}
              className={isMobile ? 'min-h-[44px]' : ''}
            >
              <Download className="h-4 w-4 mr-2" />
              {isMobile ? '' : 'Export'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-4'} gap-4`}>
        <MetricCard
          title="Total Routes"
          value={aggregatedMetrics.totalSessions || routeSessions.length}
          icon={Route}
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600"
          layout="icon-left"
          testId="card-total-routes"
        />

        <MetricCard
          title="Total Distance"
          value={aggregatedMetrics.totalDistance?.toFixed(0) || routeData.reduce((sum, route) => sum + route.distance, 0).toFixed(0)}
          suffix="km"
          icon={MapPin}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600"
          layout="icon-left"
          testId="card-total-distance-viz"
        />

        <MetricCard
          title="Total Time"
          value={Math.round((aggregatedMetrics.totalTime || routeData.reduce((sum, route) => sum + route.duration, 0)) / 3600)}
          suffix="h"
          icon={Clock}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600"
          layout="icon-left"
          testId="card-total-time-viz"
        />

        <MetricCard
          title="Shipments Delivered"
          value={aggregatedMetrics.totalShipmentsCompleted || routeData.reduce((sum, route) => sum + route.shipmentsCompleted, 0)}
          icon={Target}
          iconBgColor="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600"
          layout="icon-left"
          testId="card-shipments-delivered"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="visualization" className="w-full">
        <TabsList className={`${isMobile ? 'flex flex-col w-full h-auto p-1 bg-muted' : 'grid w-full grid-cols-4'}`}>
          <TabsTrigger
            value="visualization"
            className={`flex items-center gap-2 ${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3 mb-1' : ''}`}
          >
            <Route className="h-4 w-4" />
            {isMobile ? 'Route Playback' : 'Route Playback'}
          </TabsTrigger>
          <TabsTrigger
            value="data-table"
            className={`flex items-center gap-2 ${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3 mb-1' : ''}`}
          >
            <BarChart3 className="h-4 w-4" />
            {isMobile ? 'Route Data' : 'Route Data Table'}
          </TabsTrigger>
          <TabsTrigger
            value="comparison"
            className={`flex items-center gap-2 ${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3 mb-1' : ''}`}
          >
            <BarChart3 className="h-4 w-4" />
            {isMobile ? 'Performance Comparison' : 'Performance Comparison'}
          </TabsTrigger>
          <TabsTrigger
            value="optimization"
            className={`flex items-center gap-2 ${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3' : ''}`}
          >
            <Target className="h-4 w-4" />
            {isMobile ? 'Optimization Suggestions' : 'Optimization Suggestions'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visualization" className="mt-6">
          <RouteVisualization
            sessionId={selectedSessionId || undefined}
            sessions={routeSessions}
            onSessionSelect={handleSessionSelect}
            showComparison={!isMobile} // Hide comparison on mobile for better performance
            autoPlay={!_batteryOptimizations.reduceAnimations} // Disable autoplay on low battery
            className={isMobile ? 'mobile-optimized' : ''}
          />
        </TabsContent>

        <TabsContent value="data-table" className="mt-6">
          <RouteDataTable
            data={analyticsData}
            dataType="analytics"
            title="Route Analytics Data"
            onRowClick={handleViewRouteDetails}
            showSearch={true}
            showSorting={true}
            pageSize={isMobile ? 5 : 10}
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-6">
          <RouteComparison
            sessions={routeSessions}
            onSessionSelect={handleViewRouteDetails}
          />
        </TabsContent>

        <TabsContent value="optimization" className="mt-6">
          <RouteOptimizationSuggestions
            routeData={routeData}
            onImplementSuggestion={handleImplementSuggestion}
            onViewRouteDetails={handleViewRouteDetails}
          />
        </TabsContent>
      </Tabs>

      {/* No Data State */}
      {(routeSessions.length === 0 && !isLoading) || analyticsError ? (
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            {analyticsError
              ? `Error loading route data: ${(analyticsError as Error).message}`
              : 'No route data available for visualization. Complete some routes with GPS tracking enabled to see historical data and analysis here.'
            }
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
} export default withPageErrorBoundary(RouteVisualizationPage, 'Route Visualization');