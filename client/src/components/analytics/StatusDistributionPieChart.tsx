import { Card, CardContent } from "@/components/ui/card";
import { withChartErrorBoundary } from "@/components/ErrorBoundary";

interface StatusDistributionPieChartProps {
  statusBreakdown: Record<string, number>;
}

function StatusDistributionPieChart({ statusBreakdown }: StatusDistributionPieChartProps) {
  const statuses = Object.entries(statusBreakdown);
  const total = statuses.reduce((sum, [, count]) => sum + count, 0);

  if (total === 0) {
    return (
      <Card data-testid="card-status-chart">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h3>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>No status data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate percentages and create pie chart data
  const pieData = statuses.map(([status, count]) => ({
    status,
    count,
    percentage: Math.round((count / total) * 100)
  })).sort((a, b) => b.count - a.count);

  // Generate SVG pie chart
  let cumulativePercentage = 0;
  const radius = 60;
  const centerX = 80;
  const centerY = 80;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
      case "Picked Up":
        return "#10b981"; // green-500
      case "In Transit":
        return "#3b82f6"; // blue-500
      case "Assigned":
        return "#f59e0b"; // yellow-500
      case "Cancelled":
        return "#ef4444"; // red-500
      default:
        return "#6b7280"; // gray-500
    }
  };

  const createPath = (percentage: number) => {
    const startAngle = (cumulativePercentage * 360) / 100;
    const endAngle = ((cumulativePercentage + percentage) * 360) / 100;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);

    const largeArcFlag = percentage > 50 ? 1 : 0;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    cumulativePercentage += percentage;
    return pathData;
  };

  return (
    <Card data-testid="card-status-chart">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h3>
        <div className="flex items-center justify-center space-x-8">
          {/* Pie Chart */}
          <div className="flex-shrink-0">
            <svg width="160" height="160" viewBox="0 0 160 160" className="drop-shadow-sm">
              {pieData.map(({ status, percentage }, index) => (
                <path
                  key={status}
                  d={createPath(percentage)}
                  fill={getStatusColor(status)}
                  className="transition-all duration-300 hover:opacity-80 hover:scale-105 transform origin-center"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'brightness(1)';
                  }}
                />
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2 min-w-0">
            {pieData.map(({ status, count, percentage }) => (
              <div key={status} className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getStatusColor(status) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate" title={status}>
                      {status}
                    </span>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span className="font-bold">{count}</span>
                      <span>({percentage}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Summary */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Shipments:</span>
            <span className="font-semibold text-foreground">{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default withChartErrorBoundary(StatusDistributionPieChart, {
  componentName: 'StatusDistributionPieChart'
});
