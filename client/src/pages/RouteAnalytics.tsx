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

// Import chart components
import PerformanceMetricsChart from '@/components/analytics/PerformanceMetricsChart';
import FuelAnalyticsChart from '@/components/analytics/FuelAnalyticsChart';
import EmployeePerformanceTable from '@/components/analytics/EmployeePerformanceTable';
import RouteComparisonChart from '@/components/analytics/RouteComparisonChart';
import ExportDialog from '@/components/ui/forms/ExportDialog';

import { RouteAnalytics } from '@shared/types';

interface AnalyticsFilters {
  date_range: DateRange | undefined;
  employee_id?: string;
  view_type: 'daily' | 'weekly' | 'monthly';
}

interface Employee {
  id: string;
  name: string;
}

function RouteAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    date_range: {
      from: subDays(new Date(), 30),
      to: new Date()
    },
    view_type: 'daily'
  });

  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState('overview');
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Fetch analytics data
  const { data: analyticsData, isLoading, error, refetch } = useQuery({
    queryKey: ['route-analytics', filters],
    queryFn: async (): Promise<RouteAnalytics[]> => {
      const params = new URLSearchParams();
      if (filters.date_range?.from) params.append('start_date', format(filters.date_range.from, 'yyyy-MM-dd'));
      if (filters.date_range?.to) params.append('end_date', format(filters.date_range.to, 'yyyy-MM-dd'));
      if (filters.employee_id) params.append('employee_id', filters.employee_id);

      const url = `/api/routes/analytics${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const result = await response.json();
      return result.analytics || [];
    },
    enabled: !!filters.date_range?.from && !!filters.date_range?.to
  });

  // Fetch employee list for filter dropdown
  const { data: employees } = useQuery({
    queryKey: ['employees', filters.dateRange?.from, filters.dateRange?.to],
    queryFn: async (): Promise<Employee[]> => {
      // This would typically come from an employees API
      // For now, we'll extract unique employee IDs from analytics data
      if (analyticsData) {
        const uniqueEmployees = Array.from(new Set(analyticsData.map((item: RouteAnalytics) => item.employee_id)));
        return uniqueEmployees.map(id => ({ id, name: id ? `Employee ${id}` : 'Unknown Employee' }));
      }
      return [];
    },
    enabled: !!filters.dateRange?.from && !!filters.dateRange?.to
  });

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return {
        total_distance: 0,
        total_time: 0,
        total_fuel_cost: 0,
        total_shipments: 0,
        average_speed: 0,
        average_efficiency: 0
      };
    }

    const totals = analyticsData.reduce((acc, item: RouteAnalytics) => ({
      total_distance: acc.total_distance + (item.total_distance || 0),
      total_time: acc.total_time + (item.total_time || 0),
      total_fuel_cost: acc.total_fuel_cost + (item.fuel_cost || 0),
      total_shipments: acc.total_shipments + (item.shipments_completed || 0),
      total_fuel_consumed: acc.total_fuel_consumed + (item.fuel_consumed || 0)
    }), {
      total_distance: 0,
      total_time: 0,
      total_fuel_cost: 0,
      total_shipments: 0,
      total_fuel_consumed: 0
    });

    return {
      ...totals,
      average_speed: totals.total_time > 0 ? (totals.total_distance / (totals.total_time / 3600)) : 0,
      average_efficiency: totals.total_shipments > 0 ? (totals.total_distance / totals.total_shipments) : 0
    };
  }, [analyticsData]);

  const handleDateRangeChange = (date_range: DateRange | undefined) => {
    setFilters(prev => ({ ...prev, date_range }));
  };

  const handleEmployeeChange = (employee_id: string) => {
    setFilters(prev => ({
      ...prev,
      employee_id: employee_id === 'all' ? undefined : employee_id
    }));
  };

  const handleViewTypeChange = (view_type: 'daily' | 'weekly' | 'monthly') => {
    setFilters(prev => ({ ...prev, view_type }));
  };

  const handleExport = async () => {
    setShowExportDialog(true);
  };

  if (isLoading && !analyticsData) {
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
                  date={filters.date_range}
                  onDateChange={handleDateRangeChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={filters.employee_id || 'all'}
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
                  value={filters.view_type}
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
            value={summaryMetrics.total_distance.toFixed(1)}
            suffix=" km"
            icon={MapPin}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600"
            testId="card-total-distance"
          />

          <MetricCard
            title="Total Time"
            value={Math.round(summaryMetrics.total_time / 3600)}
            suffix=" hrs"
            icon={Clock}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600"
            testId="card-total-time"
          />

          <MetricCard
            title="Fuel Cost"
            value={`$${summaryMetrics.total_fuel_cost.toFixed(2)}`}
            icon={Fuel}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600"
            testId="card-fuel-cost"
          />

          <MetricCard
            title="Shipments"
            value={summaryMetrics.total_shipments}
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
                      viewType={filters.view_type}
                    />
                    <FuelAnalyticsChart
                      data={analyticsData || []}
                      viewType={filters.view_type}
                    />
                  </div>
                  <RouteComparisonChart
                    data={analyticsData || []}
                    viewType={filters.view_type}
                  />
                </TabsContent>

                <TabsContent value="performance" className="space-y-6 mt-0">
                  <PerformanceMetricsChart
                    data={analyticsData || []}
                    viewType={filters.view_type}
                    detailed={true}
                  />
                </TabsContent>

                <TabsContent value="fuel" className="space-y-6 mt-0">
                  <FuelAnalyticsChart
                    data={analyticsData || []}
                    viewType={filters.view_type}
                    detailed={true}
                  />
                </TabsContent>

                <TabsContent value="employees" className="space-y-6 mt-0">
                  <EmployeePerformanceTable
                    data={analyticsData || []}
                    dateRange={filters.date_range}
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
