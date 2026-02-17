import { Card, CardContent } from "@/components/ui/card";
import { withChartErrorBoundary } from "@/components/ErrorBoundary";

interface StatusDistributionPieChartProps {
  status_breakdown: Record<string, number>;
}

function StatusDistributionPieChart({ status_breakdown }: StatusDistributionPieChartProps) {
  const statuses = Object.entries(status_breakdown);
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
  const pie_data = statuses.map(([status, count]) => ({
    status,
    count,
    percentage: Math.round((count / total) * 100)
  })).sort((a, b) => b.count - a.count);

  // Generate SVG pie chart
  let cumulative_percentage = 0;
  const radius = 60;
  const center_x = 80;
  const center_y = 80;

  const get_status_color = (status: string) => {
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

  const create_path = (percentage: number) => {
    const start_angle = (cumulative_percentage * 360) / 100;
    const end_angle = ((cumulative_percentage + percentage) * 360) / 100;

    const start_angle_rad = (start_angle * Math.PI) / 180;
    const end_angle_rad = (end_angle * Math.PI) / 180;

    const x1 = center_x + radius * Math.cos(start_angle_rad);
    const y1 = center_y + radius * Math.sin(start_angle_rad);
    const x2 = center_x + radius * Math.cos(end_angle_rad);
    const y2 = center_y + radius * Math.sin(end_angle_rad);

    const large_arc_flag = percentage > 50 ? 1 : 0;

    const path_data = [
      `M ${center_x} ${center_y}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${large_arc_flag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    cumulative_percentage += percentage;
    return path_data;
  };

  return (
    <Card data-testid="card-status-chart">
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Status Distribution</h3>
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-6 sm:space-y-0 sm:space-x-8">
          {/* Pie Chart */}
          <div className="flex-shrink-0">
            <svg width="160" height="160" viewBox="0 0 160 160" className="drop-shadow-sm">
              {pie_data.map(({ status, percentage }, _index) => (
                <path
                  key={status}
                  d={create_path(percentage)}
                  fill={get_status_color(status)}
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
            {pie_data.map(({ status, count, percentage }) => (
              <div key={status} className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: get_status_color(status) }}
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
