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

import RouteVisualization from '@/components/routes/RouteVisualization';
import RouteComparison from '@/components/routes/RouteComparison';
import RouteOptimizationSuggestions from '@/components/routes/RouteOptimizationSuggestions';

// Mock data interfaces (in real app, these would come from API)
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

  // Mock data generation
  useEffect(() => {
    const generateMockData = () => {
      const employees = [
        { id: '1', name: 'John Smith' },
        { id: '2', name: 'Sarah Johnson' },
        { id: '3', name: 'Mike Davis' },
        { id: '4', name: 'Lisa Wilson' }
      ];

      const sessions: RouteSession[] = [];
      const data: RouteData[] = [];

      employees.forEach((employee, empIndex) => {
        // Generate 5-10 sessions per employee over the last 30 days
        const sessionCount = 5 + Math.floor(Math.random() * 6);

        for (let i = 0; i < sessionCount; i++) {
          const date = new Date();
          date.setDate(date.getDate() - Math.floor(Math.random() * 30));

          const sessionId = `session_${employee.id}_${i}`;
          const startTime = new Date(date);
          startTime.setHours(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));

          const duration = 3600 + Math.floor(Math.random() * 14400); // 1-5 hours
          const endTime = new Date(startTime.getTime() + duration * 1000);

          const shipmentsCompleted = 2 + Math.floor(Math.random() * 8);
          const baseDistance = shipmentsCompleted * (2 + Math.random() * 3); // 2-5 km per shipment
          const distance = baseDistance + (Math.random() - 0.5) * baseDistance * 0.3; // ±15% variation
          const averageSpeed = 25 + Math.random() * 15; // 25-40 km/h
          const fuelConsumption = distance * (0.08 + Math.random() * 0.04); // 8-12L/100km

          // Generate GPS points
          const points: RoutePoint[] = [];
          const pointCount = Math.floor(duration / 300); // Point every 5 minutes
          const startLat = 40.7128 + (Math.random() - 0.5) * 0.1;
          const startLng = -74.0060 + (Math.random() - 0.5) * 0.1;

          for (let p = 0; p < pointCount; p++) {
            const pointTime = new Date(startTime.getTime() + (p * 300 * 1000));
            const lat = startLat + (Math.random() - 0.5) * 0.02;
            const lng = startLng + (Math.random() - 0.5) * 0.02;

            points.push({
              id: `point_${sessionId}_${p}`,
              latitude: lat,
              longitude: lng,
              timestamp: pointTime.toISOString(),
              accuracy: 5 + Math.random() * 15,
              speed: averageSpeed + (Math.random() - 0.5) * 10,
              eventType: p % 10 === 0 ? (Math.random() > 0.5 ? 'pickup' : 'delivery') : 'gps'
            });
          }

          const session: RouteSession = {
            id: sessionId,
            employeeId: employee.id,
            employeeName: employee.name,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'completed',
            totalDistance: distance,
            totalTime: duration,
            averageSpeed,
            points,
            shipmentsCompleted
          };

          const routeDataItem: RouteData = {
            id: sessionId,
            employeeId: employee.id,
            employeeName: employee.name,
            date: date.toISOString().split('T')[0],
            distance,
            duration,
            shipmentsCompleted,
            fuelConsumption,
            averageSpeed,
            efficiency: distance / shipmentsCompleted,
            points: points.map(p => ({
              latitude: p.latitude,
              longitude: p.longitude,
              timestamp: p.timestamp
            }))
          };

          sessions.push(session);
          data.push(routeDataItem);
        }
      });

      setRouteSessions(sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setRouteData(data);
      setIsLoading(false);
      setLastUpdated(new Date());
    };

    // Simulate loading delay
    setTimeout(generateMockData, 1000);
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