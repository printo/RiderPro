import { Card, CardContent } from "@/components/ui/card";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";
import { RouteStatusBreakdown } from "@shared/types";

interface RouteSummaryProps {
  route_breakdown: Record<string, RouteStatusBreakdown>;
}

function RouteSummary({ route_breakdown }: RouteSummaryProps) {
  const routes = Object.entries(route_breakdown);

  return (
    <Card data-testid="card-route-summary">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Route Summary ({routes.length})
        </h3>
        <div className="max-h-96 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-2">
            {routes.length === 0 ? (
              <div className="col-span-full flex items-center justify-center h-32 text-muted-foreground">
                <p>No route data available</p>
              </div>
            ) : (
              routes.map(([route_name, route_data]) => (
                <div
                  key={route_name}
                  className="border border-border rounded-lg p-4 min-w-0"
                  data-testid={`card-route-${route_name.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between mb-2 min-w-0">
                    <h4
                      className="font-medium text-foreground truncate pr-2"
                      title={route_name}
                      data-testid={`text-route-name-${route_name}`}
                    >
                      {route_name}
                    </h4>
                    <span
                      className="text-sm text-muted-foreground flex-shrink-0"
                      data-testid={`text-route-total-${route_name}`}
                    >
                      {route_data.total} shipments
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivered:</span>
                      <span
                        className="text-green-600 font-medium"
                        data-testid={`text-route-delivered-${route_name}`}
                      >
                        {route_data.delivered}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Picked Up:</span>
                      <span
                        className="text-green-600 font-medium"
                        data-testid={`text-route-picked-up-${route_name}`}
                      >
                        {route_data.pickedup || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Pending:</span>
                      <span
                        className="text-blue-600 font-medium"
                        data-testid={`text-route-delivery-pending-${route_name}`}
                      >
                        {route_data.delivery_pending || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pickup Pending:</span>
                      <span
                        className="text-orange-600 font-medium"
                        data-testid={`text-route-pickup-pending-${route_name}`}
                      >
                        {route_data.pickup_pending || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cancelled:</span>
                      <span
                        className="text-red-600 font-medium"
                        data-testid={`text-route-cancelled-${route_name}`}
                      >
                        {route_data.cancelled || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default withComponentErrorBoundary(RouteSummary, {
  componentVariant: 'card',
  componentName: 'RouteSummary'
});