import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader } from '@/components/ui/Loader';
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
import { FuelAnalytics as FuelAnalyticsType } from '@shared/types';

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
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, city, vehicleType, refreshKey]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would be an API call to fetch analytics
      // Mock data logic preserved from original file but ensured to match interface
      const mockAnalytics: FuelAnalyticsType = {
        date: new Date().toISOString(),
        totalFuelConsumed: 1250.75,
        totalFuelCost: 125075,
        totalDistance: 18750,
        averageEfficiency: 15,
        totalCO2Emissions: 4500,
        costPerKm: 6.67,
        fuelPerKm: 0.067,
        dailyBreakdown: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          fuelConsumed: 35 + Math.random() * 15,
          fuelCost: 3500 + Math.random() * 1500,
          distance: 500 + Math.random() * 200,
        })),
        breakdown: {
          byVehicleType: {
            'standard-van': {
              fuelConsumed: 750,
              fuelCost: 75000,
              efficiency: 14.5,
              distance: 10875,
            },
            'compact-van': {
              fuelConsumed: 350,
              fuelCost: 35000,
              efficiency: 15.5,
              distance: 5425,
            },
            'electric-van': {
              fuelConsumed: 150.75,
              fuelCost: 15075,
              efficiency: 16.2,
              distance: 2450,
            },
          },
          byTimeRange: [
            { period: 'Morning', consumption: 45 },
            { period: 'Afternoon', consumption: 35 },
            { period: 'Evening', consumption: 20 },
          ],
        },
      };

      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
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
    return <div className="text-center py-10 text-muted-foreground">No data available</div>;
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
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Fuel Consumed</p>
              <Fuel className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{analytics.totalFuelConsumed?.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">L</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Fuel Cost</p>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatINR(analytics.totalFuelCost || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">CO₂ Emissions</p>
              <Zap className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{analytics.totalCO2Emissions?.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">kg</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Avg. Efficiency</p>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{analytics.averageEfficiency?.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">km/L</span>
            </div>
          </CardContent>
        </Card>
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
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-1">Cost per Kilometer</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  ₹{analytics.costPerKm?.toFixed(2)}
                  <span className="text-xs text-muted-foreground font-normal">/ km</span>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-1">Fuel per 100km</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {((analytics.fuelPerKm || 0) * 100).toFixed(1)}
                  <span className="text-xs text-muted-foreground font-normal">L / 100km</span>
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-1">CO₂ Intensity</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {(analytics.totalCO2Emissions && analytics.totalDistance 
                    ? (analytics.totalCO2Emissions / analytics.totalDistance).toFixed(1) 
                    : 0)}
                  <span className="text-xs text-muted-foreground font-normal">g / km</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
