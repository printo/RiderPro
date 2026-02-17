import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter
} from 'recharts';
import { Route, TrendingUp, BarChart3 } from 'lucide-react';
import { RouteAnalytics } from '@shared/types';

interface RouteComparisonChartProps {
  data: RouteAnalytics[];
  view_type: 'daily' | 'weekly' | 'monthly';
}

interface GroupedRouteMetrics {
  date: string;
  total_distance: number;
  total_time: number;
  shipments_completed: number;
  fuel_consumption: number;
  fuel_cost: number;
  employee_count: Set<string>;
  records: RouteAnalytics[];
}

export default function RouteComparisonChart({
  data,
  view_type
}: RouteComparisonChartProps) {
  // Group data by date for comparison
  const chart_data = React.useMemo(() => {
    const grouped = data.reduce<Record<string, GroupedRouteMetrics>>((acc, item) => {
      const key = item.date;
      if (!acc[key]) {
        acc[key] = {
          date: key,
          total_distance: 0,
          total_time: 0,
          shipments_completed: 0,
          fuel_consumption: 0,
          fuel_cost: 0,
          employee_count: new Set<string>(),
          records: []
        };
      }

      acc[key].total_distance += item.total_distance || 0;
      acc[key].total_time += item.total_time || 0;
      acc[key].shipments_completed += item.shipments_completed || 0;
      acc[key].fuel_consumption += item.fuel_consumption || 0;
      acc[key].fuel_cost += item.fuel_cost || 0;
      acc[key].employee_count.add(item.employee_id);
      acc[key].records.push(item);
      return acc;
    }, {});

    return Object.values(grouped).map((item) => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(view_type === 'monthly' && { year: 'numeric' })
      }),
      total_distance: item.total_distance,
      total_time: item.total_time / 3600, // Convert to hours
      shipments_completed: item.shipments_completed,
      fuel_consumption: item.fuel_consumption,
      fuel_cost: item.fuel_cost,
      employee_count: item.employee_count.size,
      average_speed: item.total_time > 0 ? (item.total_distance / (item.total_time / 3600)) : 0,
      efficiency: item.shipments_completed > 0 ? (item.total_distance / item.shipments_completed) : 0,
      fuel_efficiency: item.fuel_consumption > 0 ? (item.total_distance / item.fuel_consumption) : 0,
      cost_per_km: item.total_distance > 0 ? (item.fuel_cost / item.total_distance) : 0
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, view_type]);

  // Scatter plot data for efficiency analysis
  const scatter_data = React.useMemo(() => {
    return data.map(item => ({
      x: item.total_distance || 0,
      y: item.average_speed || 0,
      z: item.fuel_consumption || 0,
      employee_id: item.employee_id,
      shipments_completed: item.shipments_completed || 0,
      efficiency: item.efficiency || 0
    }));
  }, [data]);

  const format_tooltip_value = (value: number, name: string) => {
    switch (name) {
      case 'total_distance':
        return [`${value.toFixed(1)} km`, 'Distance'];
      case 'total_time':
        return [`${value.toFixed(1)} hrs`, 'Time'];
      case 'shipments_completed':
        return [`${value}`, 'Shipments'];
      case 'fuel_consumption':
        return [`${value.toFixed(2)} L`, 'Fuel'];
      case 'fuel_cost':
        return [`$${value.toFixed(2)}`, 'Cost'];
      case 'average_speed':
        return [`${value.toFixed(1)} km/h`, 'Speed'];
      case 'efficiency':
        return [`${value.toFixed(2)} km/shipment`, 'Efficiency'];
      case 'fuel_efficiency':
        return [`${value.toFixed(2)} km/L`, 'Fuel Efficiency'];
      case 'cost_per_km':
        return [`$${value.toFixed(3)}/km`, 'Cost per KM'];
      default:
        return [value, name];
    }
  };

  return (
    <div className="space-y-6">
      {/* Combined Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Route Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={format_tooltip_value} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="shipments_completed"
                fill="#10b981"
                name="Shipments Completed"
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="total_distance"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Total Distance (km)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="average_speed"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Average Speed (km/h)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distance vs Speed Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Distance vs Speed Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={scatter_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Distance"
                unit="km"
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Speed"
                unit="km/h"
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => {
                  if (name === 'z') return [`${Number(value).toFixed(2)} L`, 'Fuel Consumption'];
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    const data = payload[0].payload;
                    return `Employee ${data.employee_id} - ${data.shipments_completed} shipments`;
                  }
                  return label;
                }}
              />
              <Scatter
                name="Routes"
                dataKey="z"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fuel Efficiency Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Fuel Efficiency & Cost Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={format_tooltip_value} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="fuel_efficiency"
                fill="#10b981"
                name="Fuel Efficiency (km/L)"
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cost_per_km"
                stroke="#ef4444"
                strokeWidth={2}
                name="Cost per KM ($)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="efficiency"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Route Efficiency (km/shipment)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}