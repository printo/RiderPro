import { RouteTracking, EmployeePerformance, FuelAnalytics } from '@shared/types';
import { DistanceCalculator } from './DistanceCalculator';

export interface AggregationFilters {
  employee_ids?: string[];
  start_date?: string;
  end_date?: string;
  route_names?: string[];
  vehicle_types?: string[];
}

export interface RoutePerformanceMetrics {
  route_name: string;
  total_distance: number;
  total_time: number;
  total_shipments: number;
  average_speed: number;
  efficiency: number;
  fuel_consumption: number;
  fuel_cost: number;
  employee_count: number;
  average_distance_per_shipment: number;
  popularity_score: number; // based on usage frequency
}

export interface TimeBasedMetrics {
  period: string; // date or time range
  total_distance: number;
  total_time: number;
  total_shipments: number;
  total_fuel_consumed: number;
  total_fuel_cost: number;
  average_speed: number;
  efficiency: number;
  active_employees: number;
  peak_hours: Array<{
    hour: number;
    activity: number;
  }>;
}

export interface ComparisonMetrics {
  current: TimeBasedMetrics;
  previous: TimeBasedMetrics;
  changes: {
    distance: { value: number; percentage: number };
    time: { value: number; percentage: number };
    fuel: { value: number; percentage: number };
    cost: { value: number; percentage: number };
    efficiency: { value: number; percentage: number };
    speed: { value: number; percentage: number };
  };
  trend: 'improving' | 'declining' | 'stable';
}

export interface FuelMetrics {
  fuel_consumed: number;
  fuel_cost: number;
  efficiency: number;
  distance: number;
}

export class RouteDataAggregator {
  /**
   * Aggregate employee performance metrics
   */
  static aggregateEmployeePerformance(
    routeData: RouteTracking[],
    filters: AggregationFilters = {}
  ): EmployeePerformance[] {
    const filteredData = this.applyFilters(routeData, filters);
    const employeeGroups = this.groupByEmployee(filteredData);

    return Object.entries(employeeGroups).map(([employee_id, coordinates]) => {
      const dailyData = this.groupByDate(coordinates);
      const working_days = Object.keys(dailyData).length;

      // Calculate totals
      const total_distance = this.calculateTotalDistance(coordinates);
      const total_time = this.calculateTotalTime(coordinates);
      const total_fuel_consumed = this.calculateTotalFuel(coordinates);
      const total_fuel_cost = this.calculateTotalFuelCost(coordinates);
      const total_shipments_completed = this.countCompletedShipments(coordinates);

      // Calculate averages
      const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;
      const efficiency = total_shipments_completed > 0 ? total_distance / total_shipments_completed : 0;
      const average_distance_per_day = working_days > 0 ? total_distance / working_days : 0;
      const average_shipments_per_day = working_days > 0 ? total_shipments_completed / working_days : 0;

      // Calculate ratings and scores
      const fuel_efficiency_rating = this.calculateFuelEfficiencyRating(total_distance, total_fuel_consumed);
      const performance_score = this.calculatePerformanceScore({
        efficiency,
        average_speed,
        fuel_efficiency: total_distance / (total_fuel_consumed || 1)
      });

      return {
        employee_id,
        total_distance: Math.round(total_distance * 100) / 100,
        total_time,
        total_fuel_consumed: Math.round(total_fuel_consumed * 100) / 100,
        total_fuel_cost: Math.round(total_fuel_cost * 100) / 100,
        total_shipments_completed,
        average_speed: Math.round(average_speed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        working_days,
        average_distance_per_day: Math.round(average_distance_per_day * 100) / 100,
        average_shipments_per_day: Math.round(average_shipments_per_day * 100) / 100,
        fuel_efficiency_rating,
        performance_score: Math.round(performance_score)
      };
    });
  }

  /**
   * Aggregate route performance metrics
   */
  static aggregateRoutePerformance(
    routeData: RouteTracking[],
    filters: AggregationFilters = {}
  ): RoutePerformanceMetrics[] {
    const filteredData = this.applyFilters(routeData, filters);

    // Group by route name (extracted from shipment data or route context)
    const routeGroups = this.groupByRoute(filteredData);

    return Object.entries(routeGroups).map(([route_name, coordinates]) => {
      const total_distance = this.calculateTotalDistance(coordinates);
      const total_time = this.calculateTotalTime(coordinates);
      const total_shipments = this.countCompletedShipments(coordinates);
      const fuel_consumption = this.calculateTotalFuel(coordinates);
      const fuel_cost = this.calculateTotalFuelCost(coordinates);

      const employee_count = new Set(coordinates.map(coord => coord.employee_id)).size;
      const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;
      const efficiency = total_shipments > 0 ? total_distance / total_shipments : 0;
      const average_distance_per_shipment = total_shipments > 0 ? total_distance / total_shipments : 0;

      // Calculate popularity based on usage frequency
      const total_sessions = new Set(coordinates.map(coord => coord.session_id)).size;
      const popularity_score = this.calculatePopularityScore(total_sessions, employee_count);

      return {
        route_name,
        total_distance: Math.round(total_distance * 100) / 100,
        total_time,
        total_shipments,
        average_speed: Math.round(average_speed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        fuel_consumption: Math.round(fuel_consumption * 100) / 100,
        fuel_cost: Math.round(fuel_cost * 100) / 100,
        employee_count,
        average_distance_per_shipment: Math.round(average_distance_per_shipment * 100) / 100,
        popularity_score: Math.round(popularity_score)
      };
    });
  }

  /**
   * Aggregate time-based metrics (daily, weekly, monthly)
   */
  static aggregateTimeBasedMetrics(
    routeData: RouteTracking[],
    group_by: 'day' | 'week' | 'month',
    filters: AggregationFilters = {}
  ): TimeBasedMetrics[] {
    const filteredData = this.applyFilters(routeData, filters);
    const timeGroups = this.groupByTimePeriod(filteredData, group_by);

    return Object.entries(timeGroups).map(([period, coordinates]) => {
      const total_distance = this.calculateTotalDistance(coordinates);
      const total_time = this.calculateTotalTime(coordinates);
      const total_shipments = this.countCompletedShipments(coordinates);
      const total_fuel_consumed = this.calculateTotalFuel(coordinates);
      const total_fuel_cost = this.calculateTotalFuelCost(coordinates);

      const active_employees = new Set(coordinates.map(coord => coord.employee_id)).size;
      const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;
      const efficiency = total_shipments > 0 ? total_distance / total_shipments : 0;

      const peak_hours = this.calculatePeakHours(coordinates);

      return {
        period,
        total_distance: Math.round(total_distance * 100) / 100,
        total_time,
        total_shipments,
        total_fuel_consumed: Math.round(total_fuel_consumed * 100) / 100,
        total_fuel_cost: Math.round(total_fuel_cost * 100) / 100,
        average_speed: Math.round(average_speed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        active_employees,
        peak_hours
      };
    });
  }

  /**
   * Aggregate fuel analytics data
   */
  static aggregateFuelAnalytics(
    routeData: RouteTracking[],
    filters: AggregationFilters = {}
  ): FuelAnalytics {
    const filteredData = this.applyFilters(routeData, filters);

    const total_distance = this.calculateTotalDistance(filteredData);
    const total_fuel_consumed = this.calculateTotalFuel(filteredData);
    const total_fuel_cost = this.calculateTotalFuelCost(filteredData);

    const average_fuel_efficiency = total_fuel_consumed > 0 ? total_distance / total_fuel_consumed : 0;
    const cost_per_km = total_distance > 0 ? total_fuel_cost / total_distance : 0;
    const fuel_per_km = total_distance > 0 ? total_fuel_consumed / total_distance : 0;

    // Group by vehicle type
    const vehicle_groups = this.groupByVehicleType(filteredData);
    const by_vehicle_type: Record<string, FuelMetrics> = {};

    Object.entries(vehicle_groups).forEach(([vehicle_type, coordinates]) => {
      const distance = this.calculateTotalDistance(coordinates);
      const fuel = this.calculateTotalFuel(coordinates);
      const cost = this.calculateTotalFuelCost(coordinates);

      by_vehicle_type[vehicle_type] = {
        fuel_consumed: Math.round(fuel * 100) / 100,
        fuel_cost: Math.round(cost * 100) / 100,
        efficiency: fuel > 0 ? Math.round((distance / fuel) * 100) / 100 : 0,
        distance: Math.round(distance * 100) / 100
      };
    });

    // Group by employee
    const employee_groups = this.groupByEmployee(filteredData);
    const by_employee: Record<string, FuelMetrics> = {};

    Object.entries(employee_groups).forEach(([employee_id, coordinates]) => {
      const distance = this.calculateTotalDistance(coordinates);
      const fuel = this.calculateTotalFuel(coordinates);
      const cost = this.calculateTotalFuelCost(coordinates);

      by_employee[employee_id] = {
        fuel_consumed: Math.round(fuel * 100) / 100,
        fuel_cost: Math.round(cost * 100) / 100,
        efficiency: fuel > 0 ? Math.round((distance / fuel) * 100) / 100 : 0,
        distance: Math.round(distance * 100) / 100
      };
    });

    // Calculate trends
    const weekly_groups = this.groupByTimePeriod(filteredData, 'week');
    const trends = Object.entries(weekly_groups).map(([period, coordinates]) => {
      const distance = this.calculateTotalDistance(coordinates);
      const fuel = this.calculateTotalFuel(coordinates);
      const cost = this.calculateTotalFuelCost(coordinates);

      return {
        period,
        consumption: Math.round(fuel * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        efficiency: fuel > 0 ? Math.round((distance / fuel) * 100) / 100 : 0
      };
    });

    return {
      total_fuel_consumed: Math.round(total_fuel_consumed * 100) / 100,
      total_fuel_cost: Math.round(total_fuel_cost * 100) / 100,
      average_efficiency: Math.round(average_fuel_efficiency * 100) / 100,
      cost_per_km: Math.round(cost_per_km * 1000) / 1000, // 3 decimal places for cost
      fuel_per_km: Math.round(fuel_per_km * 1000) / 1000,
      // The schema for FuelAnalytics seems to have breakdown property
      breakdown: {
        by_vehicle_type,
        by_time_range: trends
      }
    };
  }

  /**
   * Compare metrics between two time periods
   */
  static compareTimePeriods(
    currentData: RouteTracking[],
    previousData: RouteTracking[],
    filters: AggregationFilters = {}
  ): ComparisonMetrics {
    const currentMetrics = this.aggregateTimeBasedMetrics(currentData, 'day', filters)[0] || this.getEmptyTimeMetrics();
    const previousMetrics = this.aggregateTimeBasedMetrics(previousData, 'day', filters)[0] || this.getEmptyTimeMetrics();

    const calculateChange = (current: number, previous: number) => {
      const value = current - previous;
      const percentage = previous > 0 ? (value / previous) * 100 : 0;
      return { value: Math.round(value * 100) / 100, percentage: Math.round(percentage * 100) / 100 };
    };

    const changes = {
      distance: calculateChange(currentMetrics.total_distance, previousMetrics.total_distance),
      time: calculateChange(currentMetrics.total_time, previousMetrics.total_time),
      fuel: calculateChange(currentMetrics.total_fuel_consumed, previousMetrics.total_fuel_consumed),
      cost: calculateChange(currentMetrics.total_fuel_cost, previousMetrics.total_fuel_cost),
      efficiency: calculateChange(currentMetrics.efficiency, previousMetrics.efficiency),
      speed: calculateChange(currentMetrics.average_speed, previousMetrics.average_speed)
    };

    // Determine overall trend
    const positiveChanges = Object.values(changes).filter(change => change.percentage > 5).length;
    const negativeChanges = Object.values(changes).filter(change => change.percentage < -5).length;

    let trend: 'improving' | 'declining' | 'stable';
    if (positiveChanges > negativeChanges) {
      trend = 'improving';
    } else if (negativeChanges > positiveChanges) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      current: currentMetrics,
      previous: previousMetrics,
      changes,
      trend
    };
  }

  // Helper methods

  private static applyFilters(data: RouteTracking[], filters: AggregationFilters): RouteTracking[] {
    return data.filter(coord => {
      if (filters.employee_ids && !filters.employee_ids.includes(coord.employee_id)) {
        return false;
      }
      if (filters.start_date && coord.date < filters.start_date) {
        return false;
      }
      if (filters.end_date && coord.date > filters.end_date) {
        return false;
      }
      if (filters.vehicle_types && !filters.vehicle_types.includes((coord as any).vehicle_type || 'standard')) {
        return false;
      }
      return true;
    });
  }

  private static groupByEmployee(data: RouteTracking[]): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      if (!groups[coord.employee_id]) {
        groups[coord.employee_id] = [];
      }
      groups[coord.employee_id].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static groupByRoute(data: RouteTracking[]): Record<string, RouteTracking[]> {
    // For now, we'll use a placeholder route name since it's not in the current schema
    // In a real implementation, this would come from shipment data or route context
    return data.reduce((groups, coord) => {
      const route_name = `Route-${coord.employee_id}`; // Placeholder
      if (!groups[route_name]) {
        groups[route_name] = [];
      }
      groups[route_name].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static groupByDate(data: RouteTracking[]): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      if (!groups[coord.date]) {
        groups[coord.date] = [];
      }
      groups[coord.date].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static groupByTimePeriod(
    data: RouteTracking[],
    group_by: 'day' | 'week' | 'month'
  ): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      let period: string;

      switch (group_by) {
        case 'day':
          period = coord.date;
          break;
        case 'week':
          period = this.getWeekKey(coord.date);
          break;
        case 'month':
          period = coord.date.substring(0, 7); // YYYY-MM
          break;
      }

      if (!groups[period]) {
        groups[period] = [];
      }
      groups[period].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static groupByVehicleType(data: RouteTracking[]): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      const vehicle_type = (coord as any).vehicle_type || 'standard';
      if (!groups[vehicle_type]) {
        groups[vehicle_type] = [];
      }
      groups[vehicle_type].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static calculateTotalDistance(data: RouteTracking[]): number {
    // Group by session and calculate distance for each session
    const sessions = this.groupBySession(data);
    let total_distance = 0;

    Object.values(sessions).forEach(session_coords => {
      if (session_coords.length >= 2) {
        const session_distance = DistanceCalculator.calculateRouteMetrics(session_coords).totalDistance;
        total_distance += session_distance;
      }
    });

    return total_distance;
  }

  private static calculateTotalTime(data: RouteTracking[]): number {
    const sessions = this.groupBySession(data);
    let total_time = 0;

    Object.values(sessions).forEach(session_coords => {
      if (session_coords.length >= 2) {
        const start_time = new Date(session_coords[0].timestamp);
        const end_time = new Date(session_coords[session_coords.length - 1].timestamp);
        total_time += (end_time.getTime() - start_time.getTime()) / 1000; // seconds
      }
    });

    return total_time;
  }

  private static calculateTotalFuel(data: RouteTracking[]): number {
    return data.reduce((total, coord) => total + (coord.fuel_consumption || 0), 0);
  }

  private static calculateTotalFuelCost(data: RouteTracking[]): number {
    return data.reduce((total, coord) => total + (coord.fuel_cost || 0), 0);
  }

  private static countCompletedShipments(data: RouteTracking[]): number {
    const shipment_ids = new Set(
      data
        .filter(coord => coord.shipment_id && coord.event_type)
        .map(coord => coord.shipment_id)
    );
    return shipment_ids.size;
  }

  private static groupBySession(data: RouteTracking[]): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      if (!groups[coord.session_id]) {
        groups[coord.session_id] = [];
      }
      groups[coord.session_id].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static calculatePeakHours(data: RouteTracking[]): Array<{ hour: number; activity: number }> {
    const hourly_activity = new Array(24).fill(0);

    data.forEach(coord => {
      const hour = new Date(coord.timestamp).getHours();
      hourly_activity[hour]++;
    });

    return hourly_activity.map((activity, hour) => ({ hour, activity }));
  }

  private static calculateFuelEfficiencyRating(distance: number, fuel: number): 'excellent' | 'good' | 'average' | 'poor' {
    if (fuel === 0) return 'average';

    const efficiency = distance / fuel; // km per liter

    if (efficiency >= 18) return 'excellent';
    if (efficiency >= 15) return 'good';
    if (efficiency >= 12) return 'average';
    return 'poor';
  }

  private static calculatePerformanceScore(metrics: {
    efficiency: number;
    average_speed: number;
    fuel_efficiency: number;
  }): number {
    // Normalize metrics to 0-100 scale and weight them
    const efficiency_score = Math.min(100, (metrics.efficiency / 10) * 100); // Assume 10 km/shipment is perfect
    const speed_score = Math.min(100, (metrics.average_speed / 30) * 100); // Assume 30 km/h is perfect
    const fuel_score = Math.min(100, (metrics.fuel_efficiency / 20) * 100); // Assume 20 km/L is perfect

    // Weighted average: efficiency 40%, speed 30%, fuel 30%
    return (efficiency_score * 0.4) + (speed_score * 0.3) + (fuel_score * 0.3);
  }

  private static calculatePopularityScore(sessions: number, employees: number): number {
    // Simple popularity calculation based on usage
    return Math.min(100, (sessions * 10) + (employees * 5));
  }

  private static getWeekKey(date: string): string {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setDate(d.getDate() - daysToMonday);
    return d.toISOString().split('T')[0];
  }

  private static getEmptyTimeMetrics(): TimeBasedMetrics {
    return {
      period: '',
      total_distance: 0,
      total_time: 0,
      total_shipments: 0,
      total_fuel_consumed: 0,
      total_fuel_cost: 0,
      average_speed: 0,
      efficiency: 0,
      active_employees: 0,
      peak_hours: []
    };
  }
}
