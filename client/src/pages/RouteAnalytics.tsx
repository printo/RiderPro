import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Label } from '@/components/ui/label';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import MetricCard from '@/components/ui/MetricCard';
import {
  BarChart3,
  MapPin,
  Fuel,
  Clock,
  Users,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';
import { routeAPI } from '@/apiClient/routes';
import { analyticsApi } from '@/apiClient/analytics';

// Import chart components
import PerformanceMetricsChart from '@/components/analytics/PerformanceMetricsChart';
import FuelAnalyticsChart from '@/components/analytics/FuelAnalyticsChart';
import EmployeePerformanceTable from '@/components/analytics/EmployeePerformanceTable';
import RouteComparisonChart from '@/components/analytics/RouteComparisonChart';
import ExportDialog from '@/components/ui/forms/ExportDialog';

import { AnalyticsFilters as BaseAnalyticsFilters, RouteAnalytics } from '@shared/types';

interface AnalyticsFilters extends Omit<BaseAnalyticsFilters, 'dateRange'> {
  dateRange: DateRange | undefined;
  viewType: 'daily' | 'weekly' | 'monthly';
}

interface Employee {
  id: string;
  name: string;
}

function RouteAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date()
    },
    viewType: 'daily'
  });

  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState('overview');
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Fetch analytics data
  const { data: analyticsData, isLoading, error, refetch } = useQuery({
    queryKey: ['route-analytics', filters],
    queryFn: async (): Promise<RouteAnalytics[]> => {
      return routeAPI.getRouteAnalytics({
        startDate: filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : undefined,
        endDate: filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : undefined,
        employeeId: filters.employeeId
      });
    },
    enabled: !!filters.dateRange?.from && !!filters.dateRange?.to
  });

  // Fetch employee list for filter dropdown
  const { data: employees } = useQuery({
    queryKey: ['employees', filters.dateRange?.from, filters.dateRange?.to],
    queryFn: async (): Promise<Employee[]> => {
      const metrics = await analyticsApi.getEmployeeMetrics({
        startDate: filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : undefined,
        endDate: filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : undefined,
      });
      return metrics.map((item) => ({
        id: item.employeeId,
        name: item.employeeId,
      }));
    },
    enabled: !!filters.dateRange?.from && !!filters.dateRange?.to
  });

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return {
        totalDistance: 0,
        totalTime: 0,
        totalFuelCost: 0,
        totalShipments: 0,
        averageSpeed: 0,
        averageEfficiency: 0
      };
    }

    const totals = analyticsData.reduce((acc, item: RouteAnalytics) => ({
      totalDistance: acc.totalDistance + (item.totalDistance || 0),
      totalTime: acc.totalTime + (item.totalTime || 0),
      totalFuelCost: acc.totalFuelCost + (item.fuelCost || 0),
      totalShipments: acc.totalShipments + (item.shipmentsCompleted || 0),
      totalFuelConsumed: acc.totalFuelConsumed + (item.fuelConsumed || 0)
    }), {
      totalDistance: 0,
      totalTime: 0,
      totalFuelCost: 0,
      totalShipments: 0,
      totalFuelConsumed: 0
    });

    return {
      ...totals,
      averageSpeed: totals.totalTime > 0 ? (totals.totalDistance / (totals.totalTime / 3600)) : 0,
      averageEfficiency: totals.totalShipments > 0 ? (totals.totalDistance / totals.totalShipments) : 0
    };
  }, [analyticsData]);

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setFilters(prev => ({ ...prev, dateRange }));
  };

  const handleEmployeeChange = (employeeId: string) => {
    setFilters(prev => ({
      ...prev,
      employeeId: employeeId === 'all' ? undefined : employeeId
    }));
  };

  const handleViewTypeChange = (viewType: 'daily' | 'weekly' | 'monthly') => {
    setFilters(prev => ({ ...prev, viewType }));
  };

  const handleExport = async () => {
    setShowExportDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="w-full space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
              <span className="truncate">Route Analytics</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Comprehensive insights into route performance and fuel efficiency
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button onClick={handleExport} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Date Range</Label>
                <DatePickerWithRange
                  date={filters.dateRange}
                  onDateChange={handleDateRangeChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={filters.employeeId || 'all'}
                  onValueChange={handleEmployeeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees?.map((employee: Employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>View Type</Label>
                <Select
                  value={filters.viewType}
                  onValueChange={handleViewTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Badge variant={isLoading ? "secondary" : "default"}>
                    {isLoading ? 'Loading...' : `${analyticsData?.length || 0} Records`}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Distance"
            value={summaryMetrics.totalDistance.toFixed(1)}
            suffix=" km"
            icon={MapPin}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600"
            testId="card-total-distance"
          />

          <MetricCard
            title="Total Time"
            value={Math.round(summaryMetrics.totalTime / 3600)}
            suffix=" hrs"
            icon={Clock}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600"
            testId="card-total-time"
          />

          <MetricCard
            title="Fuel Cost"
            value={`$${summaryMetrics.totalFuelCost.toFixed(2)}`}
            icon={Fuel}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600"
            testId="card-fuel-cost"
          />

          <MetricCard
            title="Shipments"
            value={summaryMetrics.totalShipments}
            icon={Users}
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600"
            testId="card-shipments"
          />
        </div>

        {/* Analytics Tabs */}
        <Card>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b">
                <TabsList className={`${isMobile ? 'flex flex-col w-full h-auto p-1 bg-muted' : 'grid w-full grid-cols-2 sm:grid-cols-4 h-auto bg-transparent rounded-none'}`}>
                  <TabsTrigger
                    value="overview"
                    className={`${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3 mb-1' : 'rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent'}`}
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="performance"
                    className={`${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3 mb-1' : 'rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent'}`}
                  >
                    Performance
                  </TabsTrigger>
                  <TabsTrigger
                    value="fuel"
                    className={`${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3 mb-1' : 'rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent'}`}
                  >
                    Fuel Analytics
                  </TabsTrigger>
                  <TabsTrigger
                    value="employees"
                    className={`${isMobile ? 'w-full min-h-[44px] justify-start px-4 py-3' : 'rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent'}`}
                  >
                    Employees
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <TabsContent value="overview" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PerformanceMetricsChart
                      data={analyticsData || []}
                      viewType={filters.viewType}
                    />
                    <FuelAnalyticsChart
                      data={analyticsData || []}
                      viewType={filters.viewType}
                    />
                  </div>
                  <RouteComparisonChart
                    data={analyticsData || []}
                    viewType={filters.viewType}
                  />
                </TabsContent>

                <TabsContent value="performance" className="space-y-6 mt-0">
                  <PerformanceMetricsChart
                    data={analyticsData || []}
                    viewType={filters.viewType}
                    detailed={true}
                  />
                </TabsContent>

                <TabsContent value="fuel" className="space-y-6 mt-0">
                  <FuelAnalyticsChart
                    data={analyticsData || []}
                    viewType={filters.viewType}
                    detailed={true}
                  />
                </TabsContent>

                <TabsContent value="employees" className="space-y-6 mt-0">
                  <EmployeePerformanceTable
                    data={analyticsData || []}
                    dateRange={filters.dateRange}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-800">
                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                <p>Failed to load analytics data. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Dialog */}
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          data={analyticsData || []}
          availableEmployees={employees || []}
        />
      </div>
    </div>
  );
}

export default withPageErrorBoundary(RouteAnalyticsPage, 'Route Analytics');
