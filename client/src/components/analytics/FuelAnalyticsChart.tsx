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
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { Fuel, DollarSign, TrendingDown, BarChart3 } from 'lucide-react';
import { RouteAnalytics } from '@shared/types';

interface FuelAnalyticsChartProps {
  data: RouteAnalytics[];
  viewType: 'daily' | 'weekly' | 'monthly';
  detailed?: boolean;
}

interface GroupedFuelMetrics {
  date: string;
  fuelConsumed: number;
  fuelCost: number;
  totalDistance: number;
  count: number;
}

interface EmployeeFuelAggregate {
  employeeId: string;
  fuelConsumed: number;
  fuelCost: number;
  totalDistance: number;
}

interface EmployeeFuelMetrics extends EmployeeFuelAggregate {
  name: string;
  efficiency: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function FuelAnalyticsChart({
  data,
  viewType,
  detailed = false
}: FuelAnalyticsChartProps) {
  // Group and aggregate fuel data by date
  const chartData = React.useMemo(() => {
    const grouped = data.reduce<Record<string, GroupedFuelMetrics>>((acc, item) => {
      const key = item.date;
      if (!acc[key]) {
        acc[key] = {
          date: key,
          fuelConsumed: 0,
          fuelCost: 0,
          totalDistance: 0,
          count: 0
        };
      }

      acc[key].fuelConsumed += item.fuelConsumed || 0;
      acc[key].fuelCost += item.fuelCost || 0;
      acc[key].totalDistance += item.totalDistance || 0;
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.values(grouped).map((item) => ({
      ...item,
      fuelEfficiency: item.fuelConsumed > 0 ? (item.totalDistance / item.fuelConsumed) : 0,
      costPerKm: item.totalDistance > 0 ? (item.fuelCost / item.totalDistance) : 0,
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(viewType === 'monthly' && { year: 'numeric' })
      })
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, viewType]);

  // Employee fuel consumption breakdown
  const employeeFuelData = React.useMemo<EmployeeFuelMetrics[]>(() => {
    const employeeData = data.reduce<Record<string, EmployeeFuelAggregate>>((acc, item) => {
      if (!acc[item.employeeId]) {
        acc[item.employeeId] = {
          employeeId: item.employeeId,
          fuelConsumed: 0,
          fuelCost: 0,
          totalDistance: 0
        };
      }

      acc[item.employeeId].fuelConsumed += item.fuelConsumed || 0;
      acc[item.employeeId].fuelCost += item.fuelCost || 0;
      acc[item.employeeId].totalDistance += item.totalDistance || 0;
      return acc;
    }, {});

    return Object.values(employeeData).map((item) => ({
      ...item,
      name: `Employee ${item.employeeId}`,
      efficiency: item.fuelConsumed > 0 ? (item.totalDistance / item.fuelConsumed) : 0
    }));
  }, [data]);

  const formatTooltipValue = (value: number, name: string) => {
    switch (name) {
      case 'fuelConsumed':
        return [`${value.toFixed(2)} L`, 'Fuel Consumed'];
      case 'fuelCost':
        return [`$${value.toFixed(2)}`, 'Fuel Cost'];
      case 'fuelEfficiency':
        return [`${value.toFixed(2)} km/L`, 'Fuel Efficiency'];
      case 'costPerKm':
        return [`$${value.toFixed(3)}/km`, 'Cost per KM'];
      default:
        return [value, name];
    }
  };

  if (!detailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Fuel Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
              <Area
                type="monotone"
                dataKey="fuelCost"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
                name="Fuel Cost ($)"
              />
              <Area
                type="monotone"
                dataKey="fuelConsumed"
                stackId="2"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.6}
                name="Fuel Consumed (L)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fuel Consumption and Cost Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Fuel Consumption & Cost Trends
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
                dataKey="fuelConsumed"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Fuel Consumed (L)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="fuelCost"
                stroke="#ef4444"
                strokeWidth={2}
                name="Fuel Cost ($)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fuel Efficiency Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Fuel Efficiency & Cost per KM
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
                dataKey="fuelEfficiency"
                fill="#10b981"
                name="Fuel Efficiency (km/L)"
              />
              <Bar
                yAxisId="right"
                dataKey="costPerKm"
                fill="#8b5cf6"
                name="Cost per KM ($)"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Employee Fuel Consumption Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Fuel Consumption by Employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={employeeFuelData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="fuelConsumed"
                >
                  {employeeFuelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} L`, 'Fuel Consumed']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Fuel Cost by Employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={employeeFuelData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Fuel Cost']} />
                <Bar dataKey="fuelCost" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Fuel Efficiency Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Employee Fuel Efficiency Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={employeeFuelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} km/L`, 'Fuel Efficiency']} />
              <Legend />
              <Bar dataKey="efficiency" fill="#10b981" name="Fuel Efficiency (km/L)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}