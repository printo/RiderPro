import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { TrendingUp, MapPin, Clock, Zap } from 'lucide-react';
import { RouteAnalytics } from '@shared/schema';

interface PerformanceMetricsChartProps {
  data: RouteAnalytics[];
  viewType: 'daily' | 'weekly' | 'monthly';
  detailed?: boolean;
}

export default function PerformanceMetricsChart({
  data,
  viewType,
  detailed = false
}: PerformanceMetricsChartProps) {
  // Group and aggregate data by date
  const chartData = React.useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const key = item.date;
      if (!acc[key]) {
        acc[key] = {
          date: key,
          totalDistance: 0,
          totalTime: 0,
          averageSpeed: 0,
          shipmentsCompleted: 0,
          efficiency: 0,
          count: 0
        };
      }

      acc[key].totalDistance += item.totalDistance || 0;
      acc[key].totalTime += item.totalTime || 0;
      acc[key].shipmentsCompleted += item.shipmentsCompleted || 0;
      acc[key].count += 1;

      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map((item: any) => ({
      ...item,
      averageSpeed: item.totalTime > 0 ? (item.totalDistance / (item.totalTime / 3600)) : 0,
      efficiency: item.shipmentsCompleted > 0 ? (item.totalDistance / item.shipmentsCompleted) : 0,
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(viewType === 'monthly' && { year: 'numeric' })
      })
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, viewType]);

  const formatTooltipValue = (value: number, name: string) => {
    switch (name) {
      case 'totalDistance':
        return [`${value.toFixed(1)} km`, 'Distance'];
      case 'totalTime':
        return [`${(value / 3600).toFixed(1)} hrs`, 'Time'];
      case 'averageSpeed':
        return [`${value.toFixed(1)} km/h`, 'Avg Speed'];
      case 'shipmentsCompleted':
        return [`${value}`, 'Shipments'];
      case 'efficiency':
        return [`${value.toFixed(2)} km/shipment`, 'Efficiency'];
      default:
        return [value, name];
    }
  };

  if (!detailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Line
                type="monotone"
                dataKey="totalDistance"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Distance (km)"
              />
              <Line
                type="monotone"
                dataKey="shipmentsCompleted"
                stroke="#10b981"
                strokeWidth={2}
                name="Shipments"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Distance and Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Distance & Time Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalDistance"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Distance (km)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalTime"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Time (seconds)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Speed and Efficiency Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Speed & Efficiency Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="averageSpeed"
                fill="#8b5cf6"
                name="Avg Speed (km/h)"
              />
              <Bar
                yAxisId="right"
                dataKey="efficiency"
                fill="#06b6d4"
                name="Efficiency (km/shipment)"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Shipments Completed Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shipments Completed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Bar
                dataKey="shipmentsCompleted"
                fill="#10b981"
                name="Shipments Completed"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}