import { Card, CardContent } from "@/components/ui/card";

interface RouteData {
  total: number;
  delivered: number;
  pickedUp: number;
  pending: number;
}

interface RoutePerformanceChartProps {
  routeBreakdown: Record<string, RouteData>;
}

export default function RoutePerformanceChart({ routeBreakdown }: RoutePerformanceChartProps) {
  return (
    <Card data-testid="card-route-chart">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Route Performance</h3>
        <div className="h-64 space-y-3">
          {Object.entries(routeBreakdown).map(([route, data]) => (
            <div key={route} className="space-y-1">
              <div className="flex justify-between text-sm font-medium">
                <span>{route}</span>
                <span>{data.total} total</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                  style={{
                    width: `${data.total > 0 ? ((data.delivered + data.pickedUp) / data.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{data.delivered + data.pickedUp} completed</span>
                <span>{data.pending} pending</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
