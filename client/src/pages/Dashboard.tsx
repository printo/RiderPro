import { useDashboard } from "@/hooks/useDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SyncStatusPanel from "@/components/sync/SyncStatusPanel";
import config from '../config';

import StatusDistributionPieChart from "@/components/analytics/StatusDistributionPieChart";
import RoutePerformanceChart from "@/components/analytics/RoutePerformanceChart";
import RouteSummary from "@/components/routes/RouteSummary";
import RouteSessionControls from "@/components/routes/RouteSessionControls";
import { Package, CheckCircle, Clock, HourglassIcon } from "lucide-react";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";
// import { useRouteTracking } from "@/hooks/useRouteAPI";
import { useAuth } from "@/hooks/useAuth";

function Dashboard() {
  const { data: metrics, isLoading, error } = useDashboard();
  const { user, logout } = useAuth();

  const employeeId = user?.employeeId || user?.username || "default-user";

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
    console.error('Dashboard error:', error);

    // Check for common error cases
    let errorMessage = 'Failed to load dashboard metrics';
    let showRetry = true;

    if (error instanceof Error) {
      if (error.message.includes('401')) {
        errorMessage = 'Session expired. Please log in again.';
        showRetry = false;
      } else if (error.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your connection.';
      }
    }

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 dark:text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">{errorMessage}</h3>
              {config.debug && (
                <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                  <p>Error details:</p>
                  <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded overflow-auto text-xs">
                    {error instanceof Error ? error.message : JSON.stringify(error, null, 2)}
                  </pre>
                </div>
              )}
              {showRetry && (
                <div className="mt-4">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!showRetry && (
                <div className="mt-4">
                  <button
                    onClick={async () => {
                      await logout();
                      window.location.href = '/login';
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Go to Login
                  </button>
                </div>
              )}
            </div>
          </div>
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

      <div className="bg-white dark:bg-card rounded-xl border border-border/60 shadow-sm p-4 sm:p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* LEFT COLUMN: Key Metrics (Compact Grid on Mobile) */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 h-full">
            <Card data-testid="card-total-shipments" className="shadow-sm border-border/60">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Total Shipments
                    </p>
                    <p
                      className="text-2xl sm:text-4xl font-extrabold text-foreground"
                      data-testid="text-total-shipments"
                    >
                      {metrics.totalShipments}
                    </p>
                  </div>
                  <div className="bg-primary/10 p-2 sm:p-3 rounded-xl">
                    <Package className="text-primary h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-in-progress" className="shadow-sm border-border/60">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      In Progress
                    </p>
                    <p
                      className="text-2xl sm:text-4xl font-extrabold text-amber-600 dark:text-amber-500"
                      data-testid="text-in-progress"
                    >
                      {metrics.inProgress}
                    </p>
                  </div>
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-2 sm:p-3 rounded-xl">
                    <Clock className="text-amber-600 dark:text-amber-500 h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-completed" className="shadow-sm border-border/60">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Completed
                    </p>
                    <p
                      className="text-2xl sm:text-4xl font-extrabold text-green-600 dark:text-green-500"
                      data-testid="text-completed"
                    >
                      {metrics.completed}
                    </p>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 sm:p-3 rounded-xl">
                    <CheckCircle className="text-green-600 dark:text-green-500 h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-pending" className="shadow-sm border-border/60">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Pending
                    </p>
                    <p
                      className="text-2xl sm:text-4xl font-extrabold text-blue-600 dark:text-blue-500"
                      data-testid="text-pending"
                    >
                      {metrics.pending}
                    </p>
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 sm:p-3 rounded-xl">
                    <HourglassIcon className="text-blue-600 dark:text-blue-500 h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Stacked Operations (Tracking & Sync) */}
          <div className="flex flex-col gap-6 h-full">
            <RouteSessionControls
              employeeId={employeeId}
              onSessionStart={() => console.log("Route session started")}
              onSessionStop={() => console.log("Route session stopped")}
            />

            <SyncStatusPanel className="flex-1" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <StatusDistributionPieChart statusBreakdown={metrics.statusBreakdown ?? {}} />
        <RoutePerformanceChart routeBreakdown={metrics.routeBreakdown ?? {}} />
      </div>

      {/* Route Summary */}
      <RouteSummary routeBreakdown={metrics.routeBreakdown ?? {}} />
    </div>
  );
}
export default withPageErrorBoundary(Dashboard, 'Dashboard');