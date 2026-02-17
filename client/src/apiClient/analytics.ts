import { RouteFilters, EmployeePerformance, FuelAnalytics } from '@shared/types';
import {
  RoutePerformanceMetrics,
  TimeBasedMetrics
} from '../services/RouteDataAggregator';
import { apiClient } from '../services/ApiClient';

export interface AnalyticsAPIResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  count?: number;
}

export interface EmployeeMetricsResponse extends AnalyticsAPIResponse {
  metrics: EmployeePerformance[];
  count: number;
}

export interface RouteMetricsResponse extends AnalyticsAPIResponse {
  metrics: RoutePerformanceMetrics[];
  count: number;
}

export interface TimeMetricsResponse extends AnalyticsAPIResponse {
  metrics: TimeBasedMetrics[];
  groupBy: 'day' | 'week' | 'month';
  count: number;
}

export interface FuelAnalyticsResponse extends AnalyticsAPIResponse {
  analytics: FuelAnalytics & {
    cost_per_km: number;
    fuel_per_km: number;
  };
}

export interface TopPerformersResponse extends AnalyticsAPIResponse {
  performers: Array<{
    employee_id: string;
    distance: number;
    efficiency: number;
    fuel: number;
    shipments: number;
  }>;
  metric: string;
  count: number;
}

export const analyticsApi = {
  /**
   * Get employee performance metrics
   */
  getEmployeeMetrics: async (filters: RouteFilters = {}): Promise<EmployeePerformance[]> => {
    const params = new URLSearchParams();
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.date) params.append('date', filters.date);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const url = `/api/v1/analytics/employees${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    const result: EmployeeMetricsResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get employee metrics');
    }

    return result.metrics;
  },

  /**
   * Get route performance metrics
   */
  getRouteMetrics: async (filters: RouteFilters = {}): Promise<RoutePerformanceMetrics[]> => {
    const params = new URLSearchParams();
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.date) params.append('date', filters.date);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const url = `/api/v1/analytics/routes${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    const result: RouteMetricsResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get route metrics');
    }

    return result.metrics;
  },

  /**
   * Get time-based metrics (daily, weekly, monthly)
   */
  getTimeBasedMetrics: async (
    groupBy: 'day' | 'week' | 'month',
    filters: RouteFilters = {}
  ): Promise<TimeBasedMetrics[]> => {
    const params = new URLSearchParams();
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.date) params.append('date', filters.date);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const url = `/api/v1/analytics/time/${groupBy}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    const result: TimeMetricsResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get time-based metrics');
    }

    return result.metrics;
  },

  /**
   * Get fuel analytics
   */
  getFuelAnalytics: async (filters: RouteFilters = {}): Promise<FuelAnalytics & { cost_per_km: number; fuel_per_km: number }> => {
    const params = new URLSearchParams();
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.date) params.append('date', filters.date);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const url = `/api/v1/analytics/fuel${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    const result: FuelAnalyticsResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get fuel analytics');
    }

    return result.analytics;
  },

  /**
   * Get top performers by metric
   */
  getTopPerformers: async (
    metric: 'distance' | 'efficiency' | 'fuel',
    limit: number = 10
  ): Promise<TopPerformersResponse['performers']> => {
    const response = await apiClient.get(`/api/v1/analytics/top-performers/${metric}?limit=${limit}`);
    const result: TopPerformersResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get top performers');
    }

    return result.performers;
  },

  /**
   * Get hourly activity data
   */
  getHourlyActivity: async (filters: RouteFilters = {}): Promise<Array<{
    hour: string;
    activity: number;
    sessions: number;
    employees: number;
  }>> => {
    const params = new URLSearchParams();
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.date) params.append('date', filters.date);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const url = `/api/v1/analytics/activity/hourly${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get hourly activity');
    }

    return result.activity;
  },

  /**
   * Get comprehensive dashboard data
   */
  getDashboardData: async (filters: RouteFilters = {}): Promise<{
    employeeMetrics: EmployeePerformance[];
    timeMetrics: TimeBasedMetrics[];
    fuelAnalytics: FuelAnalytics & { cost_per_km: number; fuel_per_km: number };
    topPerformers: {
      byDistance: TopPerformersResponse['performers'];
      byEfficiency: TopPerformersResponse['performers'];
      byFuel: TopPerformersResponse['performers'];
    };
    hourlyActivity: Array<{ hour: string; activity: number; sessions: number; employees: number }>;
  }> => {
    // Fetch all data in parallel
    const [
      employeeMetrics,
      dailyMetrics,
      fuelAnalytics,
      topByDistance,
      topByEfficiency,
      topByFuel,
      hourlyActivity
    ] = await Promise.all([
      analyticsApi.getEmployeeMetrics(filters),
      analyticsApi.getTimeBasedMetrics('day', filters),
      analyticsApi.getFuelAnalytics(filters),
      analyticsApi.getTopPerformers('distance', 5),
      analyticsApi.getTopPerformers('efficiency', 5),
      analyticsApi.getTopPerformers('fuel', 5),
      analyticsApi.getHourlyActivity(filters)
    ]);

    return {
      employeeMetrics,
      timeMetrics: dailyMetrics,
      fuelAnalytics,
      topPerformers: {
        byDistance: topByDistance,
        byEfficiency: topByEfficiency,
        byFuel: topByFuel
      },
      hourlyActivity
    };
  },

  /**
   * Export analytics data as CSV
   */
  exportAnalyticsCSV: async (
    type: 'employees' | 'routes' | 'fuel' | 'time',
    filters: RouteFilters = {},
    groupBy?: 'day' | 'week' | 'month'
  ): Promise<string> => {
    let data: unknown[];
    let headers: string[];

    switch (type) {
      case 'employees':
        data = await analyticsApi.getEmployeeMetrics(filters);
        headers = [
          'Employee ID', 'Total Distance (km)', 'Total Time (hours)',
          'Fuel Consumed (L)', 'Fuel Cost', 'Shipments Completed',
          'Average Speed (km/h)', 'Efficiency (km/shipment)', 'Working Days',
          'Avg Distance/Day', 'Avg Shipments/Day', 'Performance Score'
        ];
        break;

      case 'fuel': {
        const fuelData = await analyticsApi.getFuelAnalytics(filters);
        data = [fuelData]; // Single row for overall fuel analytics
        headers = [
          'Total Fuel Consumed (L)', 'Total Fuel Cost', 'Average Efficiency (km/L)',
          'Cost per km', 'Fuel per km'
        ];
        break;
      }

      case 'time':
        data = await analyticsApi.getTimeBasedMetrics(groupBy || 'day', filters);
        headers = [
          'Period', 'Total Distance (km)', 'Total Time (hours)', 'Total Shipments',
          'Fuel Consumed (L)', 'Fuel Cost', 'Average Speed (km/h)',
          'Efficiency (km/shipment)', 'Active Employees'
        ];
        break;

      default:
        throw new Error(`Unsupported export type: ${type}`);
    }

    return convertToCSV(data, headers);
  }
};

/**
 * Convert data array to CSV format
 */
function convertToCSV(data: unknown[], headers: string[]): string {
  const csvHeaders = headers.join(',');

  const csvRows = data.map(row => {
    // Helper to safely access properties on unknown objects
    const getProp = (obj: unknown, prop: string): unknown => {
      if (obj && typeof obj === 'object' && prop in obj) {
        return (obj as Record<string, unknown>)[prop];
      }
      return undefined;
    };

    return headers.map(header => {
      const key = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      let value: string | number = '';

      // Map headers to data properties (simplified mapping)
      switch (key) {
        case 'employeeid':
          value = (getProp(row, 'employeeId') as string) || '';
          break;
        case 'totaldistancekm':
          value = (getProp(row, 'totalDistance') as number) || 0;
          break;
        case 'totaltimehours': {
          const totalTime = getProp(row, 'totalTime') as number;
          value = totalTime ? (totalTime / 3600).toFixed(2) : '0';
          break;
        }
        case 'fuelconsumedl': {
          const totalFuel = getProp(row, 'totalFuelConsumed') as number;
          const fuel = getProp(row, 'fuelConsumed') as number;
          value = totalFuel || fuel || 0;
          break;
        }
        case 'fuelcost': {
          const totalCost = getProp(row, 'totalFuelCost') as number;
          const cost = getProp(row, 'fuelCost') as number;
          value = totalCost || cost || 0;
          break;
        }
        case 'shipmentscompleted': {
          const totalShipments = getProp(row, 'totalShipmentsCompleted') as number;
          const shipments = getProp(row, 'totalShipments') as number;
          value = totalShipments || shipments || 0;
          break;
        }
        case 'averagespeedkmh':
          value = (getProp(row, 'averageSpeed') as number) || 0;
          break;
        case 'efficiencykmshipment':
          value = (getProp(row, 'efficiency') as number) || 0;
          break;
        case 'workingdays':
          value = (getProp(row, 'workingDays') as number) || 0;
          break;
        case 'avgdistanceday':
          value = (getProp(row, 'averageDistancePerDay') as number) || 0;
          break;
        case 'avgshipmentsday':
          value = (getProp(row, 'averageShipmentsPerDay') as number) || 0;
          break;
        case 'performancescore':
          value = (getProp(row, 'performanceScore') as number) || 0;
          break;
        case 'period':
          value = (getProp(row, 'period') as string) || '';
          break;
        case 'activeemployees':
          value = (getProp(row, 'activeEmployees') as number) || 0;
          break;
        default:
          value = (getProp(row, key) as string) || '';
      }

      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

// Helper functions for data processing

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
}

/**
 * Format duration from seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format distance with appropriate units
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Format fuel consumption
 */
export function formatFuelConsumption(liters: number): string {
  return `${liters.toFixed(1)}L`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = '$'): string {
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Get performance rating based on score
 */
export function getPerformanceRating(score: number): {
  rating: 'excellent' | 'good' | 'average' | 'poor';
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      rating: 'excellent',
      color: 'text-green-600',
      description: 'Outstanding performance'
    };
  } else if (score >= 75) {
    return {
      rating: 'good',
      color: 'text-blue-600',
      description: 'Good performance'
    };
  } else if (score >= 60) {
    return {
      rating: 'average',
      color: 'text-yellow-600',
      description: 'Average performance'
    };
  } else {
    return {
      rating: 'poor',
      color: 'text-red-600',
      description: 'Needs improvement'
    };
  }
}

/**
 * Calculate trend direction
 */
export function calculateTrend(current: number, previous: number): {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  isSignificant: boolean;
} {
  const change = calculatePercentageChange(current, previous);
  const isSignificant = Math.abs(change) >= 5; // 5% threshold for significance

  let direction: 'up' | 'down' | 'stable';
  if (change > 5) {
    direction = 'up';
  } else if (change < -5) {
    direction = 'down';
  } else {
    direction = 'stable';
  }

  return {
    direction,
    percentage: Math.abs(change),
    isSignificant
  };
}
