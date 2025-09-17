import { useDashboard } from "@/hooks/useDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SyncStatusPanel from "@/components/SyncStatusPanel";
import StatusDistributionChart from "@/components/StatusDistributionChart";
import RoutePerformanceChart from "@/components/RoutePerformanceChart";
import RouteSummary from "@/components/RouteSummary";
import { Package, CheckCircle, Clock, HourglassIcon } from "lucide-react";

export default function Dashboard() {
  const { data: metrics, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-12">
          <p className="text-destructive" data-testid="text-dashboard-error">
            Failed to load dashboard metrics. Please try again.
          </p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground" data-testid="text-no-data">
            No data available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Real-time Metrics Header */}
      <div className="mb-6">
        <h2
          className="text-2xl font-bold text-foreground mb-2"
          data-testid="text-dashboard-title"
        >
          Today's Overview
        </h2>
        <p
          className="text-muted-foreground"
          data-testid="text-dashboard-subtitle"
        >
          Real-time shipment metrics and performance
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card data-testid="card-total-shipments">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Shipments
                </p>
                <p
                  className="text-2xl font-bold text-foreground"
                  data-testid="text-total-shipments"
                >
                  {metrics.totalShipments}
                </p>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg">
                <Package className="text-primary h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-completed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed
                </p>
                <p
                  className="text-2xl font-bold text-green-600"
                  data-testid="text-completed"
                >
                  {metrics.completed}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="text-green-600 h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-in-progress">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  In Progress
                </p>
                <p
                  className="text-2xl font-bold text-yellow-600"
                  data-testid="text-in-progress"
                >
                  {metrics.inProgress}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="text-yellow-600 h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending
                </p>
                <p
                  className="text-2xl font-bold text-blue-600"
                  data-testid="text-pending"
                >
                  {metrics.pending}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <HourglassIcon className="text-blue-600 h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Sync Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <SyncStatusPanel />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusDistributionChart statusBreakdown={metrics.statusBreakdown ?? {}} />
          <RoutePerformanceChart routeBreakdown={metrics.routeBreakdown ?? {}} />
        </div>
      </div>

      {/* Route Summary */}
      <RouteSummary routeBreakdown={metrics.routeBreakdown ?? {}} />
    </div>
  );
}
