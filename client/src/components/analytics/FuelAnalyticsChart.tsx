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
  view_type: 'daily' | 'weekly' | 'monthly';
  detailed?: boolean;
}

interface GroupedFuelMetrics {
  date: string;
  fuel_consumption: number;
  fuel_cost: number;
  total_distance: number;
  count: number;
}

interface EmployeeFuelAggregate {
  employee_id: string;
  fuel_consumption: number;
  fuel_cost: number;
  total_distance: number;
}

interface EmployeeFuelMetrics extends EmployeeFuelAggregate {
  name: string;
  efficiency: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function FuelAnalyticsChart({
  data,
  view_type,
  detailed = false
}: FuelAnalyticsChartProps) {
  // Group and aggregate fuel data by date
  const chart_data = React.useMemo(() => {
    const grouped = data.reduce<Record<string, GroupedFuelMetrics>>((acc, item) => {
      const key = item.date;
      if (!acc[key]) {
        acc[key] = {
          date: key,
          fuel_consumption: 0,
          fuel_cost: 0,
          total_distance: 0,
          count: 0
        };
      }

      acc[key].fuel_consumption += item.fuel_consumption || 0;
      acc[key].fuel_cost += item.fuel_cost || 0;
      acc[key].total_distance += item.total_distance || 0;
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.values(grouped).map((item) => ({
      ...item,
      fuel_efficiency: item.fuel_consumption > 0 ? (item.total_distance / item.fuel_consumption) : 0,
      cost_per_km: item.total_distance > 0 ? (item.fuel_cost / item.total_distance) : 0,
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(view_type === 'monthly' && { year: 'numeric' })
      })
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, view_type]);

  // Employee fuel consumption breakdown
  const employee_fuel_data = React.useMemo<EmployeeFuelMetrics[]>(() => {
    const employeeData = data.reduce<Record<string, EmployeeFuelAggregate>>((acc, item) => {
      if (!acc[item.employee_id]) {
        acc[item.employee_id] = {
          employee_id: item.employee_id,
          fuel_consumption: 0,
          fuel_cost: 0,
          total_distance: 0
        };
      }

      acc[item.employee_id].fuel_consumption += item.fuel_consumption || 0;
      acc[item.employee_id].fuel_cost += item.fuel_cost || 0;
      acc[item.employee_id].total_distance += item.total_distance || 0;
      return acc;
    }, {});

    return Object.values(employeeData).map((item) => ({
      ...item,
      name: `Employee ${item.employee_id}`,
      efficiency: item.fuel_consumption > 0 ? (item.total_distance / item.fuel_consumption) : 0
    }));
  }, [data]);

  const format_tooltip_value = (value: number, name: string) => {
    switch (name) {
      case 'fuel_consumption':
        return [`${value.toFixed(2)} L`, 'Fuel Consumption'];
      case 'fuel_cost':
        return [`$${value.toFixed(2)}`, 'Fuel Cost'];
      case 'fuel_efficiency':
        return [`${value.toFixed(2)} km/L`, 'Fuel Efficiency'];
      case 'cost_per_km':
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
            <AreaChart data={chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={format_tooltip_value} />
              <Legend />
              <Area
                type="monotone"
                dataKey="fuel_cost"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
                name="Fuel Cost ($)"
              />
              <Area
                type="monotone"
                dataKey="fuel_consumption"
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
                dataKey="fuel_consumed"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Fuel Consumed (L)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="fuel_cost"
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
            <BarChart data={chart_data}>
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
              />
              <Bar
                yAxisId="right"
                dataKey="cost_per_km"
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
                  data={employee_fuel_data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="fuel_consumption"
                >
                  {employee_fuel_data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} L`, 'Fuel Consumption']} />
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
              <BarChart data={employee_fuel_data} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Fuel Cost']} />
                <Bar dataKey="fuel_cost" fill="#ef4444" />
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
            <BarChart data={employee_fuel_data}>
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