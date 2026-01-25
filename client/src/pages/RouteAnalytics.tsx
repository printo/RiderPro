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

import { routeAPI } from '@/apiClient/routes';

import { AnalyticsFilters as BaseAnalyticsFilters } from '@shared/types';

interface AnalyticsFilters extends Omit<BaseAnalyticsFilters, 'dateRange'> {
  dateRange: DateRange | undefined;
  viewType: 'daily' | 'weekly' | 'monthly';
}

function RouteAnalytics() {
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
    queryFn: async () => {
      const params = {
        startDate: filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : undefined,
        endDate: filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : undefined,
        employeeId: filters.employeeId
      };

      return await routeAPI.getAnalytics(params);
    },
    enabled: !!filters.dateRange?.from && !!filters.dateRange?.to
  });

  // Fetch employee list for filter dropdown
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      // This would typically come from an employees API
      // For now, we'll extract unique employee IDs from analytics data
      if (analyticsData) {
        const uniqueEmployees = Array.from(new Set(analyticsData.map(item => item.employeeId)));
        return uniqueEmployees.map(id => ({ id, name: `Employee ${id}` }));
      }
      return [];
    },
    enabled: !!analyticsData
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

    const totals = analyticsData.reduce((acc, item) => ({
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
                    {employees?.map((employee) => (
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
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Distance</p>
                  <p className="text-2xl font-bold text-foreground">
                    {summaryMetrics.totalDistance.toFixed(1)} km
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Time</p>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.round(summaryMetrics.totalTime / 3600)} hrs
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fuel Cost</p>
                  <p className="text-2xl font-bold text-foreground">
                    ${summaryMetrics.totalFuelCost.toFixed(2)}
                  </p>
                </div>
                <Fuel className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Shipments</p>
                  <p className="text-2xl font-bold text-foreground">
                    {summaryMetrics.totalShipments}
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
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
} export default withPageErrorBoundary(RouteAnalytics, 'Route Analytics');