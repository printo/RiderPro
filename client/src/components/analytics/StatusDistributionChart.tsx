import { Card, CardContent } from "@/components/ui/card";
import { withChartErrorBoundary } from "@/components/ErrorBoundary";

interface StatusDistributionChartProps {
  statusBreakdown: Record<string, number>;
}

function StatusDistributionChart({ statusBreakdown }: StatusDistributionChartProps) {
  const statuses = Object.entries(statusBreakdown);

  return (
    <Card data-testid="card-status-chart">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h3>
        <div className="h-64 overflow-y-auto space-y-2 pr-2">
          {statuses.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <p>No status data available</p>
            </div>
          ) : (
            statuses.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-2 bg-muted/30 rounded min-w-0">
                <span className="text-sm font-medium truncate pr-2" title={status}>{status}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className={`w-16 h-2 rounded-full bg-gradient-to-r ${status === "Delivered" ? "from-green-400 to-green-600" :
                      status === "Picked Up" ? "from-green-400 to-green-600" :
                        status === "In Transit" ? "from-blue-400 to-blue-600" :
                          status === "Assigned" ? "from-yellow-400 to-yellow-600" :
                            status === "Cancelled" ? "from-red-400 to-red-600" :
                              "from-gray-400 to-gray-600"
                      }`}
                  />
                  <span className="text-sm font-bold min-w-[2rem] text-right">{count}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
export default withChartErrorBoundary(StatusDistributionChart, {
  componentName: 'StatusDistributionChart'
});