import { Card, CardContent } from "@/components/ui/card";
import { withChartErrorBoundary } from "@/components/ErrorBoundary";
import { RouteStatusBreakdown } from "@shared/types";

interface RoutePerformanceChartProps {
  routeBreakdown: Record<string, RouteStatusBreakdown>;
}

function RoutePerformanceChart({ routeBreakdown }: RoutePerformanceChartProps) {
  const routes = Object.entries(routeBreakdown);

  return (
    <Card data-testid="card-route-chart">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Route Performance</h3>
        <div className="h-64 overflow-y-auto space-y-3 pr-2">
          {routes.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <p>No route data available</p>
            </div>
          ) : (
            routes.map(([route, data]) => (
              <div key={route} className="space-y-1 min-w-0">
                <div className="flex justify-between text-sm font-medium">
                  <span className="truncate pr-2" title={route}>{route}</span>
                  <span className="flex-shrink-0">{data.total} total</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${data.total > 0 ? ((data.delivered + data.pickedUp) / data.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{data.delivered + data.pickedUp} completed</span>
                  <span>{data.pending || 0} pending</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
export default withChartErrorBoundary(RoutePerformanceChart, {
  componentName: 'RoutePerformanceChart'
});