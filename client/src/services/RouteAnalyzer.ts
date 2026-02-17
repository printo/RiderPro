import {
  RouteTracking,
  DailyRouteSummary,
  WeeklyRouteSummary,
  MonthlyRouteSummary,
  RouteSessionSummary,
  FuelConsumptionResult,
  City
} from '@shared/types';
import { DistanceCalculator } from './DistanceCalculator';
import { FuelCalculator } from './FuelCalculator';

export interface RouteOptimizationSuggestion {
  type: 'distance' | 'time' | 'fuel' | 'efficiency';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  potential_saving: {
    distance?: number; // km
    time?: number; // minutes
    fuel?: number; // liters
    cost?: number; // currency
  };
  recommendation: string;
}

export class RouteAnalyzer {
  private fuel_calculator: FuelCalculator;

  /**
   * Get the start of the week (Monday) for a given date string
   */
  private getWeekStart(date_string: string): string {
    const date = new Date(date_string);
    const day = date.getDay();
    // Adjust to get Monday as the first day of the week
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
  }

  /**
   * Add days to a date string and return the new date string
   */
  private addDays(date_string: string, days: number): string {
    const date = new Date(date_string);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Group coordinates by session ID
   */
  private groupCoordinatesBySession(coordinates: RouteTracking[]): RouteTracking[][] {
    if (!coordinates || coordinates.length === 0) {
      return [];
    }

    // Sort coordinates by timestamp to ensure correct ordering
    const sorted_coords = [...coordinates].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const sessions: RouteTracking[][] = [];
    let current_session: RouteTracking[] = [];
    let current_session_id = sorted_coords[0]?.session_id;

    for (const coord of sorted_coords) {
      if (coord.session_id !== current_session_id) {
        if (current_session.length > 0) {
          sessions.push(current_session);
        }
        current_session = [coord];
        current_session_id = coord.session_id;
      } else {
        current_session.push(coord);
      }
    }

    // Add the last session
    if (current_session.length > 0) {
      sessions.push(current_session);
    }

    return sessions;
  }

  /**
   * Create an empty session summary
   */
  private createEmptySessionSummary(session_id: string, employee_id: string): RouteSessionSummary {
    const now = new Date().toISOString();
    return {
      session_id,
      employee_id,
      start_time: now,
      end_time: now,
      total_distance: 0,
      total_time: 0,
      average_speed: 0,
      max_speed: 0,
      fuel_consumption: 0,
      fuel_cost: 0,
      shipments_completed: 0,
      coordinate_count: 0,
      efficiency: 0
    };
  }

  constructor() {
    this.fuel_calculator = new FuelCalculator();
  }

  /**
   * Analyze route data for a single session
   */
  analyzeRouteSession(
    coordinates: RouteTracking[],
    vehicle_type_id: string = 'standard-van',
    city: string = 'Delhi'
  ): RouteSessionSummary {
    if (!coordinates || coordinates.length === 0) {
      throw new Error('No coordinates provided for analysis');
    }

    const session_id = coordinates[0].session_id;
    const employee_id = coordinates[0].employee_id || '';

    // Filter coordinates for this session only
    const session_coords = coordinates.filter(coord => coord.session_id === session_id);
    if (session_coords.length < 2) {
      return this.createEmptySessionSummary(session_id, employee_id);
    }

    // Calculate route metrics
    const metrics = DistanceCalculator.calculateRouteMetrics(session_coords);

    // Count shipments completed
    const shipments_completed = new Set(
      session_coords
        .filter(coord => coord.shipment_id && coord.event_type)
        .map(coord => coord.shipment_id as string)
    ).size;

    // Initialize default fuel result
    const default_fuel_result: FuelConsumptionResult = {
      distance: 0,
      fuel_consumed: 0,
      fuel_cost: 0,
      formatted_cost: '₹0.00',
      co2_emissions: 0,
      efficiency: 0
    };

    // Calculate fuel consumption if there's distance
    const fuel_result = metrics.totalDistance > 0
      ? this.fuel_calculator.calculateFuelConsumption(
        metrics.totalDistance,
        vehicle_type_id,
        city as City,
        {
          trafficFactor: 1.0,
          weatherFactor: 1.0,
          loadFactor: 1.0,
          drivingStyle: 'normal'
        }
      )
      : default_fuel_result;

    // Calculate efficiency (km per shipment)
    const efficiency = shipments_completed > 0
      ? metrics.totalDistance / shipments_completed
      : 0;

    // Create and return the session summary
    return {
      session_id,
      employee_id,
      start_time: session_coords[0].timestamp,
      end_time: session_coords[session_coords.length - 1].timestamp,
      total_distance: Math.round(metrics.totalDistance * 100) / 100,
      total_time: metrics.totalTime,
      average_speed: Math.round(metrics.averageSpeed * 100) / 100,
      max_speed: Math.round(metrics.maxSpeed * 100) / 100,
      fuel_consumption: Math.round((fuel_result?.fuel_consumed || 0) * 100) / 100,
      fuel_cost: Math.round((fuel_result?.fuel_cost || 0) * 100) / 100,
      shipments_completed,
      coordinate_count: session_coords.length,
      efficiency: Math.round(efficiency * 100) / 100
    } as RouteSessionSummary;
  }

  /**
   * Analyze daily route data
   */
  analyzeDailyRoutes(
    coordinates: RouteTracking[],
    filters: {
      employee_id?: string;
      start_date?: string;
      end_date?: string;
      city?: string;
      vehicle_type?: string;
    } = {}
  ): DailyRouteSummary[] {
    if (!coordinates || coordinates.length === 0) {
      return [];
    }

    // Filter coordinates based on filters
    const filtered_coords = coordinates.filter(coord => {
      if (filters.employee_id && coord.employee_id !== filters.employee_id) {
        return false;
      }
      if (filters.start_date && coord.timestamp < filters.start_date) {
        return false;
      }
      if (filters.end_date && coord.timestamp > filters.end_date) {
        return false;
      }
      if (filters.city && (coord as unknown as { city?: string }).city !== filters.city) {
        return false;
      }
      return true;
    });

    if (filtered_coords.length === 0) {
      return [];
    }

    // Group coordinates by date (YYYY-MM-DD)
    const date_groups = filtered_coords.reduce<Record<string, RouteTracking[]>>((groups, coord) => {
      const date = coord.timestamp.split('T')[0]; // Extract YYYY-MM-DD from ISO string
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(coord);
      return groups;
    }, {});

    // Process each date group
    return Object.entries(date_groups).map(([date, date_coords]) => {
      // Get employee ID from first coordinate (assuming all coords for a date are from the same employee)
      const employee_id = date_coords[0]?.employee_id || '';

      // Group by session
      const session_groups = this.groupCoordinatesBySession(date_coords);
      const sessions: RouteSessionSummary[] = [];

      let total_distance = 0;
      let total_time = 0;
      let total_fuel_consumed = 0;
      let total_fuel_cost = 0;
      let total_shipments_completed = 0;
      let max_speed = 0;
      let coordinate_count = 0;

      // Analyze each session
      for (const session_coords of session_groups) {
        if (session_coords.length >= 2) {
          const session_summary = this.analyzeRouteSession(
            session_coords,
            filters.vehicle_type || 'standard-van',
            filters.city || 'Delhi'
          );
          sessions.push(session_summary);

          // Aggregate metrics
          total_distance += session_summary.total_distance || 0;
          total_time += session_summary.total_time || 0;
          total_fuel_consumed += session_summary.fuel_consumption || 0;
          total_fuel_cost += session_summary.fuel_cost || 0;
          total_shipments_completed += session_summary.shipments_completed || 0;
          max_speed = Math.max(max_speed, session_summary.max_speed || 0);
          coordinate_count += session_summary.coordinate_count || 0;
        }
      }

      // Calculate stationary time
      const stationary_periods = DistanceCalculator.findStationaryPeriods(date_coords);
      const stationary_time = stationary_periods.reduce(
        (sum, period) => sum + (period.duration * 60),
        0
      );
      const moving_time = Math.max(0, total_time - stationary_time);

      // Calculate derived metrics
      const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;
      const efficiency = total_shipments_completed > 0
        ? total_distance / total_shipments_completed
        : 0;
      const fuel_efficiency = total_fuel_consumed > 0
        ? total_distance / total_fuel_consumed
        : 0;

      // Create and return the daily summary
      return {
        employee_id,
        date,
        total_sessions: sessions.length,
        total_distance: Math.round(total_distance * 100) / 100,
        total_time,
        total_fuel_consumed: Math.round(total_fuel_consumed * 100) / 100,
        total_fuel_cost: Math.round(total_fuel_cost * 100) / 100,
        fuel_efficiency: Math.round(fuel_efficiency * 100) / 100,
        shipments_completed: total_shipments_completed,
        average_speed: Math.round(average_speed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        stationary_time,
        moving_time,
        max_speed: Math.round(max_speed * 100) / 100,
        coordinate_count,
        sessions
      } as DailyRouteSummary;
    });
  }

  /**
   * Analyze weekly route data
   */
  analyzeWeeklyRoutes(daily_summaries: DailyRouteSummary[]): WeeklyRouteSummary[] {
    if (!daily_summaries || daily_summaries.length === 0) {
      return [];
    }

    // Group daily summaries by week and employee
    const week_employee_groups = daily_summaries.reduce<Record<string, {
      week_start: string;
      employee_id: string;
      summaries: DailyRouteSummary[];
    }>>((groups, summary) => {
      const week_start = this.getWeekStart(summary.date);
      const key = `${week_start}_${summary.employee_id || 'unknown'}`;

      if (!groups[key]) {
        groups[key] = {
          week_start,
          employee_id: summary.employee_id || '',
          summaries: []
        };
      }

      groups[key].summaries.push(summary);
      return groups;
    }, {});

    // Process each week-employee group
    return Object.values(week_employee_groups).map(({ week_start, employee_id, summaries }) => {
      const week_daily_summaries = summaries.sort((a, b) => a.date.localeCompare(b.date));
      const week_end = this.addDays(week_start, 6);

      // Calculate weekly totals
      const total_distance = week_daily_summaries.reduce((sum, day) => sum + (day.total_distance || 0), 0);
      const total_time = week_daily_summaries.reduce((sum, day) => sum + (day.total_time || 0), 0);
      const total_fuel_consumed = week_daily_summaries.reduce((sum, day) => sum + (day.total_fuel_consumed || 0), 0);
      const total_fuel_cost = week_daily_summaries.reduce((sum, day) => sum + (day.total_fuel_cost || 0), 0);
      const total_shipments_completed = week_daily_summaries.reduce((sum, day) => sum + (day.shipments_completed || 0), 0);

      // Calculate working days (days with at least one session)
      const working_days = week_daily_summaries.length;

      // Calculate derived metrics
      const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;
      const efficiency = total_shipments_completed > 0
        ? total_distance / total_shipments_completed
        : 0;
      const fuel_efficiency = total_fuel_consumed > 0
        ? total_distance / total_fuel_consumed
        : 0;

      // Create and return the weekly summary
      return {
        employee_id,
        week_start,
        week_end,
        daily_summaries: week_daily_summaries,
        total_distance: Math.round(total_distance * 100) / 100,
        total_time,
        total_fuel_consumed: Math.round(total_fuel_consumed * 100) / 100,
        total_fuel_cost: Math.round(total_fuel_cost * 100) / 100,
        fuel_efficiency: Math.round(fuel_efficiency * 100) / 100,
        total_shipments_completed,
        average_speed: Math.round(average_speed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        working_days
      } as WeeklyRouteSummary;
    });
  }

  /**
   * Analyze monthly route data
   */
  analyzeMonthlyRoutes(weekly_summaries: WeeklyRouteSummary[]): MonthlyRouteSummary[] {
    // Group weekly summaries by month and employee
    const month_groups = weekly_summaries.reduce<Record<string, {
      month: string;
      employee_id: string;
      summaries: WeeklyRouteSummary[];
    }>>((groups, week) => {
      const month = week.week_start.substring(0, 7); // YYYY-MM
      const key = `${month}_${week.employee_id}`;

      if (!groups[key]) {
        groups[key] = {
          month,
          employee_id: week.employee_id,
          summaries: []
        };
      }
      groups[key].summaries.push(week);
      return groups;
    }, {});

    // Process each month group
    return Object.values(month_groups).map(({ month, employee_id, summaries: month_weekly_summaries }) => {
      // Calculate monthly totals
      const total_distance = month_weekly_summaries.reduce((sum, week) => sum + (week.total_distance ?? 0), 0);
      const total_time = month_weekly_summaries.reduce((sum, week) => sum + (week.total_time ?? 0), 0);
      const total_fuel_consumed = month_weekly_summaries.reduce((sum, week) => sum + (week.total_fuel_consumed ?? 0), 0);
      const total_fuel_cost = month_weekly_summaries.reduce((sum, week) => sum + (week.total_fuel_cost ?? 0), 0);
      const total_shipments_completed = month_weekly_summaries.reduce((sum, week) => sum + (week.total_shipments_completed ?? 0), 0);

      // Calculate working days (days with at least one session)
      const working_days = month_weekly_summaries.reduce(
        (sum, week) => sum + (week.daily_summaries?.length ?? 0),
        0
      );

      // Calculate metrics
      const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;
      const efficiency = total_shipments_completed > 0 ? total_distance / total_shipments_completed : 0;
      const fuel_efficiency = total_distance > 0 ? (total_distance / total_fuel_consumed) || 0 : 0;

      return {
        employee_id,
        month,
        weekly_summaries: month_weekly_summaries,
        total_distance: Math.round(total_distance * 100) / 100,
        total_time,
        total_fuel_consumed: Math.round(total_fuel_consumed * 100) / 100,
        total_fuel_cost: Math.round(total_fuel_cost * 100) / 100,
        fuel_efficiency: Math.round(fuel_efficiency * 100) / 100,
        total_shipments_completed,
        average_speed: Math.round(average_speed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        working_days
      };
    });
  }

  /**
   * Compare performance between employees
   */
  compareEmployeePerformance(
    summaries: DailyRouteSummary[]
  ): {
    employee_id: string;
    metrics: {
      efficiency: number;
      average_speed: number;
      fuel_consumption: number; // per 100km
      shipments_per_day: number;
    };
    ranking: {
      efficiency: number; // 1 = best
      speed: number;
      fuel: number;
      productivity: number;
    };
  }[] {
    const employee_metrics = summaries.map(summary => {
      const fuel_per_100km = summary.total_distance > 0 ? ((summary.total_fuel_consumed ?? 0) / summary.total_distance) * 100 : 0;

      return {
        employee_id: summary.employee_id,
        metrics: {
          efficiency: summary.efficiency,
          average_speed: summary.average_speed ?? 0,
          fuel_consumption: fuel_per_100km,
          shipments_per_day: summary.shipments_completed ?? 0
        }
      };
    });

    // Calculate rankings
    const with_rankings = employee_metrics.map(emp => {
      const efficiency_rank = employee_metrics.filter(other => other.metrics.efficiency < emp.metrics.efficiency).length + 1;
      const speed_rank = employee_metrics.filter(other => other.metrics.average_speed > emp.metrics.average_speed).length + 1;
      const fuel_rank = employee_metrics.filter(other => other.metrics.fuel_consumption < emp.metrics.fuel_consumption).length + 1;
      const productivity_rank = employee_metrics.filter(other => other.metrics.shipments_per_day > emp.metrics.shipments_per_day).length + 1;

      return {
        ...emp,
        ranking: {
          efficiency: efficiency_rank,
          speed: speed_rank,
          fuel: fuel_rank,
          productivity: productivity_rank
        }
      };
    });

    return with_rankings.sort((a, b) => {
      // Sort by overall performance (lower total rank is better)
      const a_total = a.ranking.efficiency + a.ranking.speed + a.ranking.fuel + a.ranking.productivity;
      const b_total = b.ranking.efficiency + b.ranking.speed + b.ranking.fuel + b.ranking.productivity;
      return a_total - b_total;
    });
  }
}
