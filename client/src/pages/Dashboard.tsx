import { useDashboard } from "@/hooks/useDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SyncStatusPanel from "@/components/SyncStatusPanel";
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
        <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-dashboard-title">
          Today's Overview
        </h2>
        <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
          Real-time shipment metrics and performance
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card data-testid="card-total-shipments">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Shipments</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-total-shipments">
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
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-completed">
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
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="text-in-progress">
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
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-pending">
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
        {/* Sync Status Panel */}
        <div className="lg:col-span-1">
          <SyncStatusPanel />
        </div>
        {/* Charts Section */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution Chart */}
          <Card data-testid="card-status-chart">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h3>
              <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400" 
                  alt="Dashboard pie chart showing shipment status distribution" 
                  className="rounded-lg w-full h-full object-cover"
                  data-testid="img-status-chart"
                />
              </div>
            </CardContent>
          </Card>

          {/* Route Performance Chart */}
          <Card data-testid="card-route-chart">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Route Performance</h3>
              <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                <img 
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400" 
                  alt="Dashboard bar chart displaying route performance metrics" 
                  className="rounded-lg w-full h-full object-cover"
                  data-testid="img-route-chart"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Route Summary */}
      <Card data-testid="card-route-summary">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Route Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(metrics.routeBreakdown).map(([routeName, routeData]) => (
              <div 
                key={routeName} 
                className="border border-border rounded-lg p-4"
                data-testid={`card-route-${routeName.toLowerCase()}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground" data-testid={`text-route-name-${routeName}`}>
                    {routeName}
                  </h4>
                  <span className="text-sm text-muted-foreground" data-testid={`text-route-total-${routeName}`}>
                    {routeData.total} shipments
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivered:</span>
                    <span className="text-green-600 font-medium" data-testid={`text-route-delivered-${routeName}`}>
                      {routeData.delivered}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Pending:</span>
                    <span className="text-blue-600 font-medium" data-testid={`text-route-delivery-pending-${routeName}`}>
                      {routeData.deliveryPending}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pickup Pending:</span>
                    <span className="text-orange-600 font-medium" data-testid={`text-route-pickup-pending-${routeName}`}>
                      {routeData.pickupPending}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cancelled:</span>
                    <span className="text-red-600 font-medium" data-testid={`text-route-cancelled-${routeName}`}>
                      {routeData.cancelled}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
