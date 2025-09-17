import React, { useState, useEffect, useRef } from 'react';
import { RouteAnalytics } from '../types/RouteAnalytics';
import '../styles/mobile.css';

interface MobileRouteAnalyticsProps {
  className?: string;
}

interface AnalyticsFilters {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  period: 'daily' | 'weekly' | 'monthly';
}

interface AnalyticsSummary {
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  totalShipments: number;
  fuelConsumed: number;
  fuelCost: number;
  efficiency: number;
  trend: 'improving' | 'stable' | 'declining';
}

export const MobileRouteAnalytics: React.FC<MobileRouteAnalyticsProps> = ({
  className = ''
}) => {
  const [analytics, setAnalytics] = useState<RouteAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: 'daily',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<
    'distance' | 'time' | 'fuel' | 'efficiency'
  >('distance');

  const containerRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);

  // Load analytics data
  const loadAnalytics = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (filters.employeeId) queryParams.append('employeeId', filters.employeeId);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      queryParams.append('period', filters.period);

      const response = await fetch(`/api/routes/analytics?${queryParams}`);
      if (!response.ok) throw new Error('Failed to load analytics');

      const data = await response.json();
      setAnalytics(data.analytics || []);

      // Calculate summary
      const summaryData = calculateSummary(data.analytics || []);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateSummary = (data: RouteAnalytics[]): AnalyticsSummary => {
    if (data.length === 0) {
      return {
        totalDistance: 0,
        totalTime: 0,
        averageSpeed: 0,
        totalShipments: 0,
        fuelConsumed: 0,
        fuelCost: 0,
        efficiency: 0,
        trend: 'stable'
      };
    }

    const totals = data.reduce(
      (acc, item) => ({
        distance: acc.distance + item.totalDistance,
        time: acc.time + item.totalTime,
        shipments: acc.shipments + item.shipmentsCompleted,
        fuel: acc.fuel + item.fuelConsumed,
        cost: acc.cost + item.fuelCost
      }),
      { distance: 0, time: 0, shipments: 0, fuel: 0, cost: 0 }
    );

    const averageSpeed = totals.time > 0 ? totals.distance / (totals.time / 3600) : 0;
    const efficiency = totals.shipments > 0 ? totals.distance / totals.shipments : 0;

    // Simple trend calculation (comparing first half vs second half)
    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);

    const firstHalfAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, item) => sum + item.efficiency, 0) /
        firstHalf.length
        : 0;
    const secondHalfAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, item) => sum + item.efficiency, 0) /
        secondHalf.length
        : 0;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (secondHalfAvg > firstHalfAvg * 1.05) trend = 'improving';
    else if (secondHalfAvg < firstHalfAvg * 0.95) trend = 'declining';

    return {
      totalDistance: totals.distance,
      totalTime: totals.time,
      averageSpeed,
      totalShipments: totals.shipments,
      fuelConsumed: totals.fuel,
      fuelCost: totals.cost,
      efficiency,
      trend
    };
  };

  // Pull-to-refresh functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current) return;

    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - pullStartY.current;

    if (pullDistance > 0 && pullDistance < 100) {
      e.preventDefault();
      // Visual feedback for pull distance
      if (containerRef.current) {
        containerRef.current.style.transform = `translateY(${pullDistance * 0.5}px)`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isPulling.current) return;

    const currentY = e.changedTouches[0].clientY;
    const pullDistance = currentY - pullStartY.current;

    if (containerRef.current) {
      containerRef.current.style.transform = 'translateY(0)';
    }

    if (pullDistance > 60) {
      setRefreshing(true);
      loadAnalytics(false);
    }

    isPulling.current = false;
  };

  // Load data on mount and filter changes
  useEffect(() => {
    loadAnalytics();
  }, [filters]);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving':
        return '📈';
      case 'declining':
        return '📉';
      default:
        return '➡️';
    }
  };

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'improving':
        return '#10b981';
      case 'declining':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getMetricValue = (metric: string, item: RouteAnalytics): string => {
    switch (metric) {
      case 'distance':
        return formatDistance(item.totalDistance);
      case 'time':
        return formatTime(item.totalTime);
      case 'fuel':
        return `${item.fuelConsumed.toFixed(1)}L`;
      case 'efficiency':
        return `${item.efficiency.toFixed(1)}`;
      default:
        return '--';
    }
  };

  if (loading && !refreshing) {
    return (
      <div className={`analytics-container ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`analytics-container ${className}`}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div className="pull-indicator visible">
          <div className="loading-spinner" />
        </div>
      )}

      {/* Header */}
      <div className="analytics-header">
        <h2>Route Analytics</h2>
        <button
          className="refresh-btn"
          onClick={() => loadAnalytics()}
          disabled={loading}
        >
          🔄
        </button>
      </div>

      {/* Filters */}
      <div className="analytics-filters">
        <div className="filter-group">
          <label className="filter-label">Period</label>
          <select
            value={filters.period}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                period: e.target.value as 'daily' | 'weekly' | 'monthly'
              }))
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => loadAnalytics()}>Retry</button>
        </div>
      )}

      {summary && (
        <>
          {/* Summary Cards */}
          <div className="analytics-summary">
            <div className="summary-card">
              <div className="summary-value">{formatDistance(summary.totalDistance)}</div>
              <div className="summary-label">Total Distance</div>
              <div className={`summary-change ${summary.trend}`}>
                {getTrendIcon(summary.trend)} {summary.trend}
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-value">{formatTime(summary.totalTime)}</div>
              <div className="summary-label">Total Time</div>
            </div>

            <div className="summary-card">
              <div className="summary-value">{Math.round(summary.averageSpeed)}</div>
              <div className="summary-label">Avg Speed (km/h)</div>
            </div>

            <div className="summary-card">
              <div className="summary-value">{summary.totalShipments}</div>
              <div className="summary-label">Shipments</div>
            </div>

            <div className="summary-card">
              <div className="summary-value">{summary.fuelConsumed.toFixed(1)}L</div>
              <div className="summary-label">Fuel Used</div>
            </div>

            <div className="summary-card">
              <div className="summary-value">{formatCurrency(summary.fuelCost)}</div>
              <div className="summary-label">Fuel Cost</div>
            </div>
          </div>

          {/* Metric Selector */}
          <div className="metric-selector">
            <div className="metric-tabs">
              {(['distance', 'time', 'fuel', 'efficiency'] as const).map((metric) => (
                <button
                  key={metric}
                  className={`metric-tab ${selectedMetric === metric ? 'active' : ''}`}
                  onClick={() => setSelectedMetric(metric)}
                >
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Analytics List */}
          <div className="analytics-list">
            {analytics.map((item) => (
              <div key={`${item.employeeId}-${item.date}`} className="analytics-item">
                <div className="item-header">
                  <div className="item-date">
                    {new Date(item.date).toLocaleDateString()}
                  </div>
                  <div className="item-employee">{item.employeeId}</div>
                </div>

                <div className="item-metrics">
                  <div className="metric-primary">
                    <span className="metric-value-large">
                      {getMetricValue(selectedMetric, item)}
                    </span>
                    <span className="metric-label-small">{selectedMetric}</span>
                  </div>

                  <div className="metric-secondary">
                    <div className="secondary-metric">
                      <span>{item.shipmentsCompleted}</span>
                      <span>shipments</span>
                    </div>
                    <div className="secondary-metric">
                      <span>{Math.round(item.averageSpeed)}</span>
                      <span>km/h avg</span>
                    </div>
                  </div>
                </div>

                <div className="item-progress">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.min(
                        100,
                        (item.efficiency / (summary.efficiency || 1)) * 100
                      )}%`,
                      backgroundColor: getTrendColor(summary.trend)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {analytics.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No Data Available</h3>
              <p>No route analytics found for the selected period.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MobileRouteAnalytics;