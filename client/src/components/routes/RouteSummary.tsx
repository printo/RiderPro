import { Card, CardContent } from "@/components/ui/card";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";

interface RouteData {
  total: number;
  delivered: number;
  pickedUp: number;
  deliveryPending: number;
  pickupPending: number;
  cancelled: number;
}

interface RouteSummaryProps {
  routeBreakdown: Record<string, RouteData>;
}

function RouteSummary({ routeBreakdown }: RouteSummaryProps) {
  return (
    <Card data-testid="card-route-summary">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Route Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(routeBreakdown).map(([routeName, routeData]) => (
            <div
              key={routeName}
              className="border border-border rounded-lg p-4"
              data-testid={`card-route-${routeName.toLowerCase()}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4
                  className="font-medium text-foreground"
                  data-testid={`text-route-name-${routeName}`}
                >
                  {routeName}
                </h4>
                <span
                  className="text-sm text-muted-foreground"
                  data-testid={`text-route-total-${routeName}`}
                >
                  {routeData.total} shipments
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivered:</span>
                  <span
                    className="text-green-600 font-medium"
                    data-testid={`text-route-delivered-${routeName}`}
                  >
                    {routeData.delivered}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Picked Up:</span>
                  <span
                    className="text-green-600 font-medium"
                    data-testid={`text-route-picked-up-${routeName}`}
                  >
                    {routeData.pickedUp || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Pending:</span>
                  <span
                    className="text-blue-600 font-medium"
                    data-testid={`text-route-delivery-pending-${routeName}`}
                  >
                    {routeData.deliveryPending}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pickup Pending:</span>
                  <span
                    className="text-orange-600 font-medium"
                    data-testid={`text-route-pickup-pending-${routeName}`}
                  >
                    {routeData.pickupPending}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cancelled:</span>
                  <span
                    className="text-red-600 font-medium"
                    data-testid={`text-route-cancelled-${routeName}`}
                  >
                    {routeData.cancelled}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
export default withComponentErrorBoundary(RouteSummary, {
  componentVariant: 'card',
  componentName: 'RouteSummary'
});