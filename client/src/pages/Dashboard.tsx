import { useDashboard } from "@/hooks/useDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SyncStatusPanel from "@/components/sync/SyncStatusPanel";
import SyncStatusIndicator from "@/components/sync/SyncStatusIndicator";
import StatusDistributionPieChart from "@/components/analytics/StatusDistributionPieChart";
import RoutePerformanceChart from "@/components/analytics/RoutePerformanceChart";
import RouteSummary from "@/components/routes/RouteSummary";
import RouteSessionControls from "@/components/routes/RouteSessionControls";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { Package, CheckCircle, Clock, HourglassIcon, Navigation, Wifi } from "lucide-react";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";
import { useRouteTracking } from "@/hooks/useRouteAPI";
import { useAuth } from "@/hooks/useAuth";

function Dashboard() {
  const { data: metrics, isLoading, error } = useDashboard();
  const { user, logout } = useAuth();

  const employeeId = user?.employeeId || user?.username || "default-user";
  const { hasActiveSession, activeSession } = useRouteTracking(employeeId);

  if (isLoading) {
    return (
      <ResponsiveContainer>
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
      </ResponsiveContainer>
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
      <ResponsiveContainer>
        <div className="bg-red-50 border-l-4 border-red-400 p-4 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 dark:text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">{errorMessage}</h3>
              {process.env.NODE_ENV === 'development' && (
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
                    onClick={() => {
                      logout();
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
      </ResponsiveContainer>
    );
  }

  if (!metrics) {
    return (
      <ResponsiveContainer>
        <div className="text-center py-12">
          <p className="text-muted-foreground" data-testid="text-no-data">
            No data available
          </p>
        </div>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
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

      {/* Route Tracking & Sync Status */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-w-0">
            {/* Route Tracking Section */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold">Route Tracking</h3>
              </div>
              <div className="space-y-4 min-w-0">
                <RouteSessionControls
                  employeeId={employeeId}
                  onSessionStart={() => console.log("Route session started")}
                  onSessionStop={() => console.log("Route session stopped")}
                />
                {hasActiveSession && (
                  <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                          Active Session
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        GPS tracking active for deliveries
                      </p>
                      {activeSession && (
                        <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                          ID: {activeSession.id.slice(-8)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Sync Status Section */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold">Sync Status</h3>
              </div>
              <div className="space-y-4 min-w-0">
                {/* External Sync Status */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">External Sync</h4>
                  <SyncStatusPanel />
                </div>

                {/* Offline Sync Status */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Offline Sync</h4>
                  <SyncStatusIndicator showDetails={true} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  className="text-2xl font-bold text-green-600 dark:text-green-400"
                  data-testid="text-completed"
                >
                  {metrics.completed}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <CheckCircle className="text-green-600 dark:text-green-400 h-6 w-6" />
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
                  className="text-2xl font-bold text-yellow-600 dark:text-yellow-400"
                  data-testid="text-in-progress"
                >
                  {metrics.inProgress}
                </p>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg">
                <Clock className="text-yellow-600 dark:text-yellow-400 h-6 w-6" />
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
                  className="text-2xl font-bold text-blue-600 dark:text-blue-400"
                  data-testid="text-pending"
                >
                  {metrics.pending}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <HourglassIcon className="text-blue-600 dark:text-blue-400 h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <StatusDistributionPieChart statusBreakdown={metrics.statusBreakdown ?? {}} />
        <RoutePerformanceChart routeBreakdown={metrics.routeBreakdown ?? {}} />
      </div>

      {/* Route Summary */}
      <RouteSummary routeBreakdown={metrics.routeBreakdown ?? {}} />
    </ResponsiveContainer>
  );
}
export default withPageErrorBoundary(Dashboard, 'Dashboard');