import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import {
  Route,
  BarChart3,
  Target,
  Calendar,
  Download,
  RefreshCw,
  MapPin,
  Clock
} from 'lucide-react';
import { useMobileOptimization } from '../hooks/useMobileOptimization';
import { apiRequest } from '@/lib/queryClient';

import RouteVisualization from '@/components/routes/RouteVisualization';
import RouteComparison from '@/components/routes/RouteComparison';
import RouteOptimizationSuggestions from '@/components/routes/RouteOptimizationSuggestions';

// Route data interfaces
interface RoutePoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  eventType?: 'pickup' | 'delivery' | 'gps';
  shipmentId?: string;
}

interface RouteSession {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'paused';
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  points: RoutePoint[];
  shipmentsCompleted: number;
}

interface RouteData {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  distance: number;
  duration: number;
  shipmentsCompleted: number;
  fuelConsumption: number;
  averageSpeed: number;
  efficiency: number;
  points: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
  }>;
}

function RouteVisualizationPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [routeSessions, setRouteSessions] = useState<RouteSession[]>([]);
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const mobileOptimization = useMobileOptimization({
    enableGestures: true,
    enableBatteryMonitoring: true,
    enableNetworkMonitoring: true
  });

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);

        // Add timeout to prevent long waits for blocked requests
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );

        const sessionsPromise = apiRequest('GET', '/api/routes/sessions?limit=100');

        const sessionsResp = await Promise.race([sessionsPromise, timeoutPromise]) as Response;
        const sessionsData = await sessionsResp.json();
        const sessions: RouteSession[] = (sessionsData.data || []).map((s: any) => ({
          id: s.id,
          employeeId: s.employee_id,
          employeeName: s.employee_id,
          startTime: s.start_time,
          endTime: s.end_time,
          status: s.status,
          totalDistance: Number(s.total_distance || 0),
          totalTime: Number(s.total_time || 0),
          averageSpeed: 0,
          points: [],
          shipmentsCompleted: 0,
        }));

        // Derive basic routeData aggregates from sessions (until detailed analytics endpoints are added)
        const data: RouteData[] = sessions.map(s => ({
          id: s.id,
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          date: s.startTime?.split('T')[0],
          distance: s.totalDistance,
          duration: s.totalTime,
          shipmentsCompleted: s.shipmentsCompleted,
          fuelConsumption: 0,
          averageSpeed: s.totalTime > 0 ? (s.totalDistance / (s.totalTime / 3600)) : 0,
          efficiency: s.shipmentsCompleted > 0 ? (s.totalDistance / s.shipmentsCompleted) : 0,
          points: []
        }));

        setRouteSessions(sessions);
        setRouteData(data);
        setLastUpdated(new Date());
      } catch (e) {
        console.error('Failed to load route sessions:', e);

        // Provide fallback data to prevent empty state
        const fallbackSessions: RouteSession[] = [];
        const fallbackData: RouteData[] = [];

        setRouteSessions(fallbackSessions);
        setRouteData(fallbackData);
        setLastUpdated(new Date());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleRefreshData = () => {
    setIsLoading(true);
    // In real app, this would fetch fresh data from API
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 1000);
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

  const handleSessionSelect = async (sessionId: string) => {
    try {
      setSelectedSessionId(sessionId);

      // Add timeout to prevent long waits for blocked requests
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      );

      const sessionPromise = apiRequest('GET', `/api/routes/session/${sessionId}`);

      const resp = await Promise.race([sessionPromise, timeoutPromise]) as Response;
      const { data } = await resp.json();
      const coords = (data?.coordinates || []) as Array<{ latitude: number; longitude: number; timestamp: string; accuracy?: number; speed?: number; event_type?: string; shipment_id?: string; }>;

      setRouteSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        points: coords.map((c, idx) => ({
          id: `${sessionId}_${idx}`,
          latitude: Number(c.latitude),
          longitude: Number(c.longitude),
          timestamp: c.timestamp,
          accuracy: c.accuracy ? Number(c.accuracy) : undefined,
          speed: c.speed ? Number(c.speed) : undefined,
          eventType: (c.event_type as any) || 'gps',
          shipmentId: (c as any).shipment_id
        }))
      } : s));
    } catch (e) {
      console.error('Failed to load session details:', e);
      // Don't show error to user, just log it and continue with empty data
    }
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

  const isMobile = mobileOptimization.deviceCapabilities.screenSize === 'small';
  const batteryOptimizations = mobileOptimization.optimizeForBattery();
  const networkOptimizations = mobileOptimization.optimizeForNetwork();

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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{routeSessions.length}</p>
                <p className="text-sm text-gray-600">Total Routes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {routeData.reduce((sum, route) => sum + route.distance, 0).toFixed(0)}km
                </p>
                <p className="text-sm text-gray-600">Total Distance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(routeData.reduce((sum, route) => sum + route.duration, 0) / 3600)}h
                </p>
                <p className="text-sm text-gray-600">Total Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {routeData.reduce((sum, route) => sum + route.shipmentsCompleted, 0)}
                </p>
                <p className="text-sm text-gray-600">Shipments Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="visualization" className="w-full">
        <TabsList className={`${isMobile ? 'flex flex-col w-full h-auto p-1 bg-muted' : 'grid w-full grid-cols-3'}`}>
          <TabsTrigger
            value="visualization"
            className={`flex items-center gap-2 ${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3 mb-1' : ''}`}
          >
            <Route className="h-4 w-4" />
            {isMobile ? 'Route Playback' : 'Route Playback'}
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
            autoPlay={!batteryOptimizations.reduceAnimations} // Disable autoplay on low battery
            className={isMobile ? 'mobile-optimized' : ''}
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-6">
          <RouteComparison
            sessions={routeData.map(data => ({
              id: data.id,
              employeeId: data.employeeId,
              employeeName: data.employeeName,
              date: data.date,
              metrics: {
                distance: data.distance,
                duration: data.duration,
                averageSpeed: data.averageSpeed,
                shipmentsCompleted: data.shipmentsCompleted,
                fuelConsumption: data.fuelConsumption,
                efficiency: data.efficiency,
                startTime: routeSessions.find(s => s.id === data.id)?.startTime || '',
                endTime: routeSessions.find(s => s.id === data.id)?.endTime || ''
              },
              points: data.points.length,
              status: 'completed' as const
            }))}
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
      {routeSessions.length === 0 && !isLoading && (
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            No route data available for visualization. Complete some routes with GPS tracking enabled to see historical data and analysis here.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} export default withPageErrorBoundary(RouteVisualizationPage, 'Route Visualization');