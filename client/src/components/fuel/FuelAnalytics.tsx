import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader } from '@/components/ui/Loader';
import CompactMetricCard from '@/components/ui/CompactMetricCard';
import SimpleStatCard from '@/components/ui/SimpleStatCard';
import { 
  Fuel, 
  DollarSign, 
  Zap, 
  Calendar as CalendarIcon, 
  TrendingUp
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Legend
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { FuelAnalytics as FuelAnalyticsType, RouteFilters } from '@shared/types';
import { analyticsApi } from '@/apiClient/analytics';

// Helper for currency formatting
const formatINR = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

interface FuelAnalyticsProps {
  dateRange: [Date, Date];
  city?: string;
  vehicleType?: string;
  refreshKey: number;
}

export const FuelAnalytics: React.FC<FuelAnalyticsProps> = ({ 
  dateRange, 
  city, 
  vehicleType,
  refreshKey 
}) => {
  const [analytics, setAnalytics] = useState<FuelAnalyticsType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, city, vehicleType, refreshKey]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: RouteFilters = {
        ...(city ? { city } : {}),
        // Convert dateRange to ISO strings if provided
        ...(dateRange && dateRange[0] && dateRange[1]
          ? {
              start_date: dateRange[0].toISOString().split('T')[0],
              end_date: dateRange[1].toISOString().split('T')[0],
            }
          : {}),
      };

      const fuelData = await analyticsApi.getFuelAnalytics(filters);

      const analytics: FuelAnalyticsType = {
        date: new Date().toISOString(),
        total_fuel_consumed: fuelData.total_fuel_consumed ?? 0,
        total_fuel_cost: fuelData.total_fuel_cost ?? 0,
        total_distance: fuelData.total_distance ?? 0,
        average_efficiency: fuelData.average_efficiency ?? 0,
        total_co2_emissions: fuelData.total_co2_emissions ?? 0,
        cost_per_km: fuelData.cost_per_km ?? 0,
        fuel_per_km: fuelData.fuel_per_km ?? 0,
        // Leave detailed breakdowns empty until backend supports them
        daily_breakdown: [],
        breakdown: {
          by_vehicle_type: {},
          by_time_range: [],
        },
      };

      setAnalytics(analytics);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch fuel analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader size="lg" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        {error
          ? `No fuel analytics available: ${error}`
          : 'No fuel analytics data available for the selected period.'}
      </div>
    );
  }

  // Prepare chart data
  const chartData = analytics.dailyBreakdown?.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    fuelConsumed: Number(d.fuelConsumed.toFixed(1)),
    fuelCost: Number(d.fuelCost.toFixed(0)),
    distance: Number(d.distance.toFixed(1)),
    efficiency: d.fuelConsumed > 0 ? Number((d.distance / d.fuelConsumed).toFixed(1)) : 0
  })) || [];

  const vehicleTypeData = analytics.breakdown?.byVehicleType 
    ? Object.entries(analytics.breakdown.byVehicleType).map(([key, value]) => ({
        type: key.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        consumption: Number(value.fuelConsumed.toFixed(1)),
        cost: value.fuelCost,
        efficiency: value.efficiency
      }))
    : [];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Fuel className="h-6 w-6 text-orange-500" />
            Fuel Analytics
          </h2>
          <p className="text-muted-foreground">
            Insights and metrics about fuel consumption and efficiency
          </p>
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          {['week', 'month', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as 'week' | 'month' | 'year')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeRange === range 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactMetricCard
          title="Fuel Consumed"
          value={analytics.totalFuelConsumed?.toFixed(1) || '0'}
          suffix="L"
          icon={Fuel}
          iconColor="text-blue-500"
          testId="card-fuel-consumed"
        />

        <CompactMetricCard
          title="Fuel Cost"
          value={formatINR(analytics.totalFuelCost || 0)}
          icon={DollarSign}
          iconColor="text-green-500"
          testId="card-fuel-cost"
        />

        <CompactMetricCard
          title="CO₂ Emissions"
          value={analytics.totalCO2Emissions?.toFixed(1) || '0'}
          suffix="kg"
          icon={Zap}
          iconColor="text-orange-500"
          testId="card-co2-emissions"
        />

        <CompactMetricCard
          title="Avg. Efficiency"
          value={analytics.averageEfficiency?.toFixed(1) || '0'}
          suffix="km/L"
          icon={TrendingUp}
          iconColor="text-purple-500"
          testId="card-avg-efficiency"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Fuel Consumption Trend
            </CardTitle>
            <CardDescription>Daily fuel consumption over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ChartContainer config={{
                fuelConsumed: { label: "Fuel (L)", color: "hsl(var(--chart-1))" },
                efficiency: { label: "Efficiency (km/L)", color: "hsl(var(--chart-2))" }
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="fuelConsumed"
                      stroke="var(--color-fuelConsumed)"
                      fill="var(--color-fuelConsumed)"
                      fillOpacity={0.2}
                      name="Fuel Consumed"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="efficiency"
                      stroke="var(--color-efficiency)"
                      strokeWidth={2}
                      dot={false}
                      name="Efficiency"
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consumption by Vehicle</CardTitle>
            <CardDescription>Breakdown by vehicle type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ChartContainer config={{
                consumption: { label: "Fuel (L)", color: "hsl(var(--chart-3))" }
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vehicleTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="type" 
                      type="category" 
                      width={100}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar 
                      dataKey="consumption" 
                      fill="var(--color-consumption)" 
                      radius={[0, 4, 4, 0]} 
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost Trend</CardTitle>
            <CardDescription>Daily fuel cost (INR)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ChartContainer config={{
                fuelCost: { label: "Cost (₹)", color: "hsl(var(--chart-4))" }
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                    />
                    <YAxis 
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="fuelCost"
                      stroke="var(--color-fuelCost)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fuel Efficiency Metrics</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <SimpleStatCard
                title="Cost per Kilometer"
                value={`₹${analytics.costPerKm?.toFixed(2) || '0'}`}
                suffix="/ km"
                testId="stat-cost-per-km"
              />
              <SimpleStatCard
                title="Fuel per 100km"
                value={((analytics.fuelPerKm || 0) * 100).toFixed(1)}
                suffix="L / 100km"
                testId="stat-fuel-per-100km"
              />
              <SimpleStatCard
                title="CO₂ Intensity"
                value={(analytics.totalCO2Emissions && analytics.totalDistance 
                  ? (analytics.totalCO2Emissions / analytics.totalDistance).toFixed(1) 
                  : '0')}
                suffix="g / km"
                testId="stat-co2-intensity"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
