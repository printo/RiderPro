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
  on_export?: () => void;
  on_refresh?: () => void;
}

interface AnalyticsSummary {
  total_routes: number;
  total_distance: number;
  average_efficiency: number;
  total_fuel_consumed: number;
  average_speed: number;
}

export const MobileRouteAnalytics: React.FC<MobileRouteAnalyticsProps> = ({
  data,
  on_export,
  on_refresh
}) => {
  const [selected_period, set_selected_period] = useState<'day' | 'week' | 'month'>('week');
  const [analytics, setAnalytics] = useState<RouteAnalytics[]>([]);

  useEffect(() => {
    setAnalytics(data);
  }, [data]);

  const calculate_summary = (data: RouteAnalytics[]): AnalyticsSummary => {
    if (data.length === 0) {
      return {
        total_routes: 0,
        total_distance: 0,
        average_efficiency: 0,
        total_fuel_consumed: 0,
        average_speed: 0
      };
    }

    const total_routes = data.length;
    const total_distance = data.reduce((sum, item) => sum + (item.total_distance || 0), 0);
    const total_fuel_consumed = data.reduce((sum, item) => sum + (item.fuel_consumption || 0), 0);
    const average_efficiency = data.reduce((sum, item) => sum + (item.efficiency || 0), 0) / total_routes;
    const average_speed = data.reduce((sum, item) => sum + (item.average_speed || 0), 0) / total_routes;

    return {
      total_routes,
      total_distance,
      average_efficiency,
      total_fuel_consumed,
      average_speed
    };
  };

  const summary = calculate_summary(analytics);

  const format_number = (num: number, decimals: number = 1): string => {
    return num.toFixed(decimals);
  };

  const format_distance = (distance: number): string => {
    if (distance >= 1000) {
      return `${format_number(distance / 1000)} km`;
    }
    return `${format_number(distance)} m`;
  };

  const get_efficiency_color = (efficiency: number): string => {
    if (efficiency >= 80) return 'text-green-600';
    if (efficiency >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const get_efficiency_badge_variant = (efficiency: number): "default" | "secondary" | "destructive" | "outline" => {
    if (efficiency >= 80) return 'default';
    if (efficiency >= 60) return 'secondary';
    return 'destructive';
  };

  const get_metric_value = (metric: string, item: RouteAnalytics): string => {
    switch (metric) {
      case 'distance':
        return format_distance(item.total_distance);
      case 'efficiency':
        return `${format_number(item.efficiency || 0)}%`;
      case 'fuel':
        return `${format_number(item.fuel_consumption || 0)}L`;
      case 'speed':
        return `${format_number(item.average_speed || 0)} km/h`;
      case 'time':
        return `${format_number((item.total_time || 0) / 60)} min`;
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
          {on_refresh && (
            <Button variant="outline" size="sm" onClick={on_refresh}>
              Refresh
            </Button>
          )}
          {on_export && (
            <Button variant="outline" size="sm" onClick={on_export}>
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
            variant={selected_period === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => set_selected_period(period)}
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
          value={summary.total_routes}
          icon={Package}
          iconBgColor="bg-transparent"
          iconColor="text-transparent"
          layout="no-icon"
          className="p-3"
          testId="card-total-routes-mobile"
        />

        <MetricCard
          title="Total Distance"
          value={format_distance(summary.total_distance)}
          icon={MapPin}
          iconBgColor="bg-transparent"
          iconColor="text-transparent"
          layout="no-icon"
          className="p-3"
          testId="card-total-distance-mobile"
        />

        <MetricCard
          title="Avg Efficiency"
          value={format_number(summary.average_efficiency)}
          suffix="%"
          icon={Fuel}
          iconBgColor="bg-transparent"
          iconColor="text-transparent"
          valueColor={get_efficiency_color(summary.average_efficiency)}
          layout="no-icon"
          className="p-3"
          testId="card-avg-efficiency-mobile"
        />

        <MetricCard
          title="Fuel Used"
          value={`${format_number(summary.total_fuel_consumed)}L`}
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
                    <Badge variant={get_efficiency_badge_variant(route.efficiency || 0)}>
                      {format_number(route.efficiency || 0)}% efficiency
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Distance:</span>
                      <span className="ml-1 font-medium">{get_metric_value('distance', route)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Speed:</span>
                      <span className="ml-1 font-medium">{get_metric_value('speed', route)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fuel:</span>
                      <span className="ml-1 font-medium">{get_metric_value('fuel', route)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <span className="ml-1 font-medium">{get_metric_value('time', route)}</span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Efficiency</span>
                      <span>{format_number(route.efficiency || 0)}%</span>
                    </div>
                    <Progress value={route.efficiency || 0} className="h-2" />
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
