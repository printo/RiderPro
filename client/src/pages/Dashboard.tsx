import { useMemo, useEffect, useState } from 'react';
import { useDashboard } from "@/hooks/useDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SyncStatusPanel from "@/components/sync/SyncStatusPanel";
import config from '../config';

import StatusDistributionPieChart from "@/components/analytics/StatusDistributionPieChart";
import RoutePerformanceChart from "@/components/analytics/RoutePerformanceChart";
import RouteSummary from "@/components/routes/RouteSummary";
import RouteSessionControls from "@/components/routes/RouteSessionControls";
import { Package, CheckCircle, Clock } from "lucide-react";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";
import MetricCard from "@/components/ui/MetricCard";
import { useAuth } from "@/hooks/useAuth";
import { isManagerUser } from "@/lib/roles";
import ActiveRouteTracking from "@/components/routes/ActiveRouteTracking";
import DashboardShipmentActions from "@/components/shipments/DashboardShipmentActions";
import { useRouteSessionContext } from "@/contexts/RouteSessionContext";
import { scrollToElementId } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Dashboard() {
  const { data: metrics, isLoading, error } = useDashboard();
  const { user, logout } = useAuth();
  const employee_id = user?.employee_id || user?.username || "default-user";
  const has_manager_access = isManagerUser(user);
  const {
    session: activeSession,
    coordinates
  } = useRouteSessionContext();

  const [show_route_map_dialog, set_show_route_map_dialog] = useState(false);

  // When URL has #route-map (e.g. after click or refresh), scroll to the section
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== 'route-map') return;
    if (!activeSession) return;

    const t = setTimeout(() => {
      scrollToElementId('route-map');
    }, 200);
    return () => clearTimeout(t);
  }, [activeSession]);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash.replace('#', '') === 'route-map') {
        scrollToElementId('route-map');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const current_location = useMemo(() => {
    if (coordinates.length > 0) {
      const last_coord = coordinates[coordinates.length - 1];
      return { latitude: last_coord.latitude, longitude: last_coord.longitude };
    }

    // Fallback to active session starting position if no coordinates yet
    if (activeSession?.start_latitude && activeSession?.start_longitude) {
      return {
        latitude: activeSession.start_latitude,
        longitude: activeSession.start_longitude
      };
    }

    return undefined;
  }, [coordinates, activeSession]);

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
    let error_message = 'Failed to load dashboard metrics';
    let show_retry = true;

    if (error instanceof Error) {
      if (error.message.includes('401')) {
        error_message = 'Session expired. Please log in again.';
        show_retry = false;
      } else if (error.message.includes('NetworkError')) {
        error_message = 'Network error. Please check your connection.';
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
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">{error_message}</h3>
              {config.debug && (
                <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                  <p>Error details:</p>
                  <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded overflow-auto text-xs">
                    {error instanceof Error ? error.message : JSON.stringify(error, null, 2)}
                  </pre>
                </div>
              )}
              {show_retry && (
                <div className="mt-4">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!show_retry && (
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
            <MetricCard
              title="Total Orders"
              value={metrics.total_shipments}
              icon={Package}
              iconBgColor="bg-primary/10"
              iconColor="text-primary"
              testId="card-total-shipments"
            />

            <MetricCard
              title="Picked Up"
              value={metrics.status_breakdown?.["Picked Up"] || 0}
              icon={Package}
              iconBgColor="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-500"
              valueColor="text-blue-600 dark:text-blue-500"
              testId="card-picked-up"
            />

            <MetricCard
              title="In Progress"
              value={metrics.in_progress || 0}
              icon={Clock}
              iconBgColor="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-500"
              valueColor="text-amber-600 dark:text-amber-500"
              testId="card-in-progress"
            />

            <MetricCard
              title="Completed"
              value={metrics.delivered_shipments ?? 0}
              icon={CheckCircle}
              iconBgColor="bg-green-100 dark:bg-green-900/30"
              iconColor="text-green-600 dark:text-green-500"
              valueColor="text-green-600 dark:text-green-500"
              testId="card-completed"
            />
          </div>

          {/* RIGHT COLUMN: Stacked Operations (Tracking & Sync) */}
          <div className="flex flex-col gap-6 h-full">
            {/* Hide RouteSessionControls for managers/admins - they don't start routes */}
            {!(user?.role === "admin" || user?.role === "manager" || user?.is_super_user || user?.is_ops_team || user?.is_staff) && (
              <RouteSessionControls
                employeeId={employee_id}
                onSessionStart={() => console.log("Route session started")}
                onSessionStop={() => console.log("Route session stopped")}
                onOpenRouteMap={() => set_show_route_map_dialog(true)}
              />
            )}

            <SyncStatusPanel className="flex-1" />
          </div>
        </div>
      </div>

      {/* Route map dialog - opens from "View route map & drop points" so map is always visible */}
      {activeSession && (
        <Dialog open={show_route_map_dialog} onOpenChange={set_show_route_map_dialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>Route map & drop points</DialogTitle>
            </DialogHeader>
            <div className="p-4 pt-2">
              <ActiveRouteTracking
                sessionId={activeSession.id}
                currentLocation={current_location}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Active Route Tracking Section: map, drop points, Open in Google Maps (inline) */}
      {activeSession && (
        <div id="route-map" className="mb-8 scroll-mt-4">
          <h3 className="text-lg font-semibold mb-3">Route map & drop points</h3>
          <ActiveRouteTracking
            sessionId={activeSession.id}
            currentLocation={current_location}
          />
        </div>
      )}

      {/* Rider actions from dashboard (single + bulk status updates) */}
      {!has_manager_access && (
        <DashboardShipmentActions employeeId={employee_id} />
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <StatusDistributionPieChart status_breakdown={metrics.status_breakdown ?? {}} />
        <RoutePerformanceChart route_breakdown={metrics.route_breakdown ?? {}} />
      </div>

      {/* Route Summary */}
      <RouteSummary route_breakdown={metrics.route_breakdown ?? {}} />
    </div>
  );
}
export default withPageErrorBoundary(Dashboard, 'Dashboard');