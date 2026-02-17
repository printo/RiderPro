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
import { RouteAnalytics } from '@shared/types';

interface PerformanceMetricsChartProps {
  data: RouteAnalytics[];
  view_type: 'daily' | 'weekly' | 'monthly';
  detailed?: boolean;
}

interface GroupedMetrics {
  date: string;
  total_distance: number;
  total_time: number;
  average_speed: number;
  shipments_completed: number;
  efficiency: number;
  count: number;
}

export default function PerformanceMetricsChart({
  data,
  view_type,
  detailed = false
}: PerformanceMetricsChartProps) {
  // Group and aggregate data by date
  const chart_data = React.useMemo(() => {
    const grouped = data.reduce<Record<string, GroupedMetrics>>((acc, item) => {
      const key = item.date;
      if (!acc[key]) {
        acc[key] = {
          date: key,
          total_distance: 0,
          total_time: 0,
          average_speed: 0,
          shipments_completed: 0,
          efficiency: 0,
          count: 0
        };
      }

      acc[key].total_distance += item.total_distance || 0;
      acc[key].total_time += item.total_time || 0;
      acc[key].shipments_completed += item.shipments_completed || 0;
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.values(grouped).map((item) => ({
      ...item,
      average_speed: item.total_time > 0 ? (item.total_distance / (item.total_time / 3600)) : 0,
      efficiency: item.shipments_completed > 0 ? (item.total_distance / item.shipments_completed) : 0,
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(view_type === 'monthly' && { year: 'numeric' })
      })
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, view_type]);

  const format_tooltip_value = (value: number, name: string) => {
    switch (name) {
      case 'total_distance':
        return [`${value.toFixed(1)} km`, 'Distance'];
      case 'total_time':
        return [`${(value / 3600).toFixed(1)} hrs`, 'Time'];
      case 'average_speed':
        return [`${value.toFixed(1)} km/h`, 'Avg Speed'];
      case 'shipments_completed':
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
            <LineChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={format_tooltip_value} />
              <Legend />
              <Line
                type="monotone"
                dataKey="total_distance"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Distance (km)"
              />
              <Line
                type="monotone"
                dataKey="shipments_completed"
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
            <LineChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={format_tooltip_value} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total_distance"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Distance (km)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="total_time"
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
            <BarChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={format_tooltip_value} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="average_speed"
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
            <BarChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={format_tooltip_value} />
              <Legend />
              <Bar
                dataKey="shipments_completed"
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