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
  viewType: 'daily' | 'weekly' | 'monthly';
}

interface GroupedRouteMetrics {
  date: string;
  totalDistance: number;
  totalTime: number;
  shipmentsCompleted: number;
  fuelConsumed: number;
  fuelCost: number;
  employeeCount: Set<string>;
  records: RouteAnalytics[];
}

export default function RouteComparisonChart({
  data,
  viewType
}: RouteComparisonChartProps) {
  // Group data by date for comparison
  const chartData = React.useMemo(() => {
    const grouped = data.reduce<Record<string, GroupedRouteMetrics>>((acc, item) => {
      const key = item.date;
      if (!acc[key]) {
        acc[key] = {
          date: key,
          totalDistance: 0,
          totalTime: 0,
          shipmentsCompleted: 0,
          fuelConsumed: 0,
          fuelCost: 0,
          employeeCount: new Set<string>(),
          records: []
        };
      }

      acc[key].totalDistance += item.totalDistance || 0;
      acc[key].totalTime += item.totalTime || 0;
      acc[key].shipmentsCompleted += item.shipmentsCompleted || 0;
      acc[key].fuelConsumed += item.fuelConsumed || 0;
      acc[key].fuelCost += item.fuelCost || 0;
      acc[key].employeeCount.add(item.employeeId);
      acc[key].records.push(item);
      return acc;
    }, {});

    return Object.values(grouped).map((item) => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(viewType === 'monthly' && { year: 'numeric' })
      }),
      totalDistance: item.totalDistance,
      totalTime: item.totalTime / 3600, // Convert to hours
      shipmentsCompleted: item.shipmentsCompleted,
      fuelConsumed: item.fuelConsumed,
      fuelCost: item.fuelCost,
      employeeCount: item.employeeCount.size,
      averageSpeed: item.totalTime > 0 ? (item.totalDistance / (item.totalTime / 3600)) : 0,
      efficiency: item.shipmentsCompleted > 0 ? (item.totalDistance / item.shipmentsCompleted) : 0,
      fuelEfficiency: item.fuelConsumed > 0 ? (item.totalDistance / item.fuelConsumed) : 0,
      costPerKm: item.totalDistance > 0 ? (item.fuelCost / item.totalDistance) : 0
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, viewType]);

  // Scatter plot data for efficiency analysis
  const scatterData = React.useMemo(() => {
    return data.map(item => ({
      x: item.totalDistance || 0,
      y: item.averageSpeed || 0,
      z: item.fuelConsumed || 0,
      employeeId: item.employeeId,
      shipmentsCompleted: item.shipmentsCompleted || 0,
      efficiency: item.efficiency || 0
    }));
  }, [data]);

  const formatTooltipValue = (value: number, name: string) => {
    switch (name) {
      case 'totalDistance':
        return [`${value.toFixed(1)} km`, 'Distance'];
      case 'totalTime':
        return [`${value.toFixed(1)} hrs`, 'Time'];
      case 'shipmentsCompleted':
        return [`${value}`, 'Shipments'];
      case 'fuelConsumed':
        return [`${value.toFixed(2)} L`, 'Fuel'];
      case 'fuelCost':
        return [`$${value.toFixed(2)}`, 'Cost'];
      case 'averageSpeed':
        return [`${value.toFixed(1)} km/h`, 'Speed'];
      case 'efficiency':
        return [`${value.toFixed(2)} km/shipment`, 'Efficiency'];
      case 'fuelEfficiency':
        return [`${value.toFixed(2)} km/L`, 'Fuel Efficiency'];
      case 'costPerKm':
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
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="shipmentsCompleted"
                fill="#10b981"
                name="Shipments Completed"
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalDistance"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Total Distance (km)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="averageSpeed"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Average Speed (km/h)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Efficiency vs Distance Scatter Plot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Distance vs Speed Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={scatterData}>
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
                  if (name === 'z') return [`${Number(value).toFixed(2)} L`, 'Fuel Consumed'];
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    const data = payload[0].payload;
                    return `Employee ${data.employeeId} - ${data.shipmentsCompleted} shipments`;
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
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="fuelEfficiency"
                fill="#10b981"
                name="Fuel Efficiency (km/L)"
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="costPerKm"
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