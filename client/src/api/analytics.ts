import { RouteFilters } from '@shared/schema';
import {
  EmployeePerformanceMetrics,
  RoutePerformanceMetrics,
  TimeBasedMetrics,
  FuelAnalyticsData
} from '../services/RouteDataAggregator';

export interface AnalyticsAPIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  count?: number;
}

export interface EmployeeMetricsResponse extends AnalyticsAPIResponse {
  metrics: EmployeePerformanceMetrics[];
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
  analytics: FuelAnalyticsData & {
    costPerKm: number;
    fuelPerKm: number;
  };
}

export interface TopPerformersResponse extends AnalyticsAPIResponse {
  performers: Array<{
    employeeId: string;
    totalDistance: number;
    totalShipments: number;
    efficiency: number;
    fuelEfficiency: number;
    workingDays: number;
  }>;
  metric: string;
  count: number;
}

export const analyticsApi = {
  /**
   * Get employee performance metrics
   */
  getEmployeeMetrics: async (filters: RouteFilters = {}): Promise<EmployeePerformanceMetrics[]> => {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.date) params.append('date', filters.date);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `/api/analytics/employees${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
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
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.date) params.append('date', filters.date);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `/api/analytics/routes${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
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
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.date) params.append('date', filters.date);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `/api/analytics/time/${groupBy}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    const result: TimeMetricsResponse = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get time-based metrics');
    }

    return result.metrics;
  },

  /**
   * Get fuel analytics
   */
  getFuelAnalytics: async (filters: RouteFilters = {}): Promise<FuelAnalyticsData & { costPerKm: number; fuelPerKm: number }> => {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.date) params.append('date', filters.date);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `/api/analytics/fuel${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
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
    const response = await fetch(`/api/analytics/top-performers/${metric}?limit=${limit}`);
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
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.date) params.append('date', filters.date);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `/api/analytics/activity/hourly${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
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
    employeeMetrics: EmployeePerformanceMetrics[];
    timeMetrics: TimeBasedMetrics[];
    fuelAnalytics: FuelAnalyticsData & { costPerKm: number; fuelPerKm: number };
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
    let data: any[];
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

      case 'fuel':
        const fuelData = await analyticsApi.getFuelAnalytics(filters);
        data = [fuelData]; // Single row for overall fuel analytics
        headers = [
          'Total Fuel Consumed (L)', 'Total Fuel Cost', 'Average Efficiency (km/L)',
          'Cost per km', 'Fuel per km'
        ];
        break;

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
function convertToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');

  const csvRows = data.map(row => {
    return headers.map(header => {
      const key = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      let value = '';

      // Map headers to data properties (simplified mapping)
      switch (key) {
        case 'employeeid':
          value = row.employeeId || '';
          break;
        case 'totaldistancekm':
          value = row.totalDistance || 0;
          break;
        case 'totaltimehours':
          value = row.totalTime ? (row.totalTime / 3600).toFixed(2) : '0';
          break;
        case 'fuelconsumedl':
          value = row.totalFuelConsumed || row.fuelConsumed || 0;
          break;
        case 'fuelcost':
          value = row.totalFuelCost || row.fuelCost || 0;
          break;
        case 'shipmentscompleted':
          value = row.totalShipmentsCompleted || row.totalShipments || 0;
          break;
        case 'averagespeedkmh':
          value = row.averageSpeed || 0;
          break;
        case 'efficiencykmshipment':
          value = row.efficiency || 0;
          break;
        case 'workingdays':
          value = row.workingDays || 0;
          break;
        case 'avgdistanceday':
          value = row.averageDistancePerDay || 0;
          break;
        case 'avgshipmentsday':
          value = row.averageShipmentsPerDay || 0;
          break;
        case 'performancescore':
          value = row.performanceScore || 0;
          break;
        case 'period':
          value = row.period || '';
          break;
        case 'activeemployees':
          value = row.activeEmployees || 0;
          break;
        default:
          value = row[key] || '';
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