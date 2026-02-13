import React, { useState, useEffect } from 'react';
import { RouteAnalytics } from '@shared/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { withChartErrorBoundary } from '@/components/ErrorBoundary';
import MetricCard from '@/components/ui/MetricCard';
import { Package, MapPin, Fuel, Users } from 'lucide-react';

interface MobileRouteAnalyticsProps {
  data: RouteAnalytics[];
  onExport?: () => void;
  onRefresh?: () => void;
}

interface AnalyticsSummary {
  totalRoutes: number;
  totalDistance: number;
  averageEfficiency: number;
  totalFuelConsumed: number;
  averageSpeed: number;
}

export const MobileRouteAnalytics: React.FC<MobileRouteAnalyticsProps> = ({
  data,
  onExport,
  onRefresh
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [analytics, setAnalytics] = useState<RouteAnalytics[]>([]);

  useEffect(() => {
    setAnalytics(data);
  }, [data]);

  const calculateSummary = (data: RouteAnalytics[]): AnalyticsSummary => {
    if (data.length === 0) {
      return {
        totalRoutes: 0,
        totalDistance: 0,
        averageEfficiency: 0,
        totalFuelConsumed: 0,
        averageSpeed: 0
      };
    }

    const totalRoutes = data.length;
    const totalDistance = data.reduce((sum, item) => sum + item.totalDistance, 0);
    const totalFuelConsumed = data.reduce((sum, item) => sum + item.fuelConsumption, 0);
    const averageEfficiency = data.reduce((sum, item) => sum + item.efficiency, 0) / totalRoutes;
    const averageSpeed = data.reduce((sum, item) => sum + item.averageSpeed, 0) / totalRoutes;

    return {
      totalRoutes,
      totalDistance,
      averageEfficiency,
      totalFuelConsumed,
      averageSpeed
    };
  };

  const summary = calculateSummary(analytics);

  const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toFixed(decimals);
  };

  const formatDistance = (distance: number): string => {
    if (distance >= 1000) {
      return `${formatNumber(distance / 1000)} km`;
    }
    return `${formatNumber(distance)} m`;
  };

  const getEfficiencyColor = (efficiency: number): string => {
    if (efficiency >= 80) return 'text-green-600';
    if (efficiency >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEfficiencyBadgeVariant = (efficiency: number): "default" | "secondary" | "destructive" | "outline" => {
    if (efficiency >= 80) return 'default';
    if (efficiency >= 60) return 'secondary';
    return 'destructive';
  };

  const getMetricValue = (metric: string, item: RouteAnalytics): string => {
    switch (metric) {
      case 'distance':
        return formatDistance(item.totalDistance);
      case 'efficiency':
        return `${formatNumber(item.efficiency)}%`;
      case 'fuel':
        return `${formatNumber(item.fuelConsumption)}L`;
      case 'speed':
        return `${formatNumber(item.averageSpeed)} km/h`;
      case 'time':
        return `${formatNumber(item.totalTime / 60)} min`;
      default:
        return 'N/A';
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Route Analytics</h2>
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['day', 'week', 'month'] as const).map((period) => (
          <Button
            key={period}
            variant={selectedPeriod === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod(period)}
            className="capitalize"
          >
            {period}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Total Routes"
          value={summary.totalRoutes}
          icon={Package}
          iconBgColor="bg-transparent"
          iconColor="text-transparent"
          layout="no-icon"
          className="p-3"
          testId="card-total-routes-mobile"
        />

        <MetricCard
          title="Total Distance"
          value={formatDistance(summary.totalDistance)}
          icon={MapPin}
          iconBgColor="bg-transparent"
          iconColor="text-transparent"
          layout="no-icon"
          className="p-3"
          testId="card-total-distance-mobile"
        />

        <MetricCard
          title="Avg Efficiency"
          value={formatNumber(summary.averageEfficiency)}
          suffix="%"
          icon={Fuel}
          iconBgColor="bg-transparent"
          iconColor="text-transparent"
          valueColor={getEfficiencyColor(summary.averageEfficiency)}
          layout="no-icon"
          className="p-3"
          testId="card-avg-efficiency-mobile"
        />

        <MetricCard
          title="Fuel Used"
          value={`${formatNumber(summary.totalFuelConsumed)}L`}
          icon={Users}
          iconBgColor="bg-transparent"
          iconColor="text-transparent"
          layout="no-icon"
          className="p-3"
          testId="card-fuel-used-mobile"
        />
      </div>

      {/* Route List */}
      <div className="space-y-3">
        <h3 className="font-semibold">Recent Routes</h3>
        {analytics.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No route data available
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {analytics.slice(0, 5).map((route, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Route #{index + 1}</div>
                    <Badge variant={getEfficiencyBadgeVariant(route.efficiency)}>
                      {formatNumber(route.efficiency)}% efficiency
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Distance:</span>
                      <span className="ml-1 font-medium">{getMetricValue('distance', route)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Speed:</span>
                      <span className="ml-1 font-medium">{getMetricValue('speed', route)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fuel:</span>
                      <span className="ml-1 font-medium">{getMetricValue('fuel', route)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <span className="ml-1 font-medium">{getMetricValue('time', route)}</span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Efficiency</span>
                      <span>{formatNumber(route.efficiency)}%</span>
                    </div>
                    <Progress value={route.efficiency} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default withChartErrorBoundary(MobileRouteAnalytics, {
  componentVariant: 'card',
  componentName: 'MobileRouteAnalytics'
});
