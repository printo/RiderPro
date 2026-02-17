// /client/src/hooks/useRouteAnalytics.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { routeAPI } from '@/apiClient/routes';
import { RouteAnalyzer } from '../services/RouteAnalyzer';
import {
  DailyRouteSummary,
  WeeklyRouteSummary,
  MonthlyRouteSummary,
  VehicleType,
  FuelAnalytics,
  FuelPrice,
  FuelConsumptionResult,
  FuelOptimizationSuggestion,
  City
} from '@shared/types';
import { FuelCalculator } from '../services/FuelCalculator';
import { DistanceCalculator } from '../services/DistanceCalculator';
import { RouteTracking, RouteFilters, AnalyticsFilters } from '@shared/types';

export interface AnalyticsState {
  daily_summaries: DailyRouteSummary[];
  weekly_summaries: WeeklyRouteSummary[];
  monthly_summaries: MonthlyRouteSummary[];
  fuel_analytics: {
    daily: Array<FuelConsumptionResult & { date: string }>;
    weekly: Array<FuelConsumptionResult & { week_start: string }>;
    monthly: Array<FuelConsumptionResult & { month: string }>;
  };
  optimization_suggestions: FuelOptimizationSuggestion[];
  is_loading: boolean;
  error: string | null;
  last_updated: Date | null;
}

export function useRouteAnalytics(filters: AnalyticsFilters = {}) {
  const [analytics_state, set_analytics_state] = useState<AnalyticsState>({
    daily_summaries: [],
    weekly_summaries: [],
    monthly_summaries: [],
    fuel_analytics: {
      daily: [],
      weekly: [],
      monthly: []
    },
    optimization_suggestions: [],
    is_loading: false,
    error: null,
    last_updated: null
  });

  // Initialize analyzers
  const route_analyzer = useMemo(() => new RouteAnalyzer(), []);
  const fuel_calculator = useMemo(() => new FuelCalculator(), []);

  // Fetch route tracking data
  const route_filters: RouteFilters = useMemo(() => ({
    employee_id: filters.employee_id,
    start_date: filters.start_date,
    end_date: filters.end_date,
    city: filters.city,
    vehicle_type: filters.vehicle_type
  }), [filters.employee_id, filters.start_date, filters.end_date, filters.city, filters.vehicle_type]);

  const {
    data: route_data,
    isLoading: is_loading_routes,
    error: route_error,
    refetch: refetch_routes
  } = useQuery({
    queryKey: ['route-analytics', route_filters],
    queryFn: async () => {
      const data = await routeAPI.getSessionCoordinates('all');
      return Array.isArray(data) ? data : [];
    },
    enabled: true,
    refetchInterval: 300000, // 5 minutes
  });

  /**
   * Calculate fuel consumption for a set of coordinates
   */
  const calculate_fuel_consumption = useCallback((
    coordinates: RouteTracking[],
    vehicle_type_id: string,
    city: string
  ): FuelConsumptionResult | null => {
    if (!coordinates || coordinates.length === 0) return null;

    const metrics = DistanceCalculator.calculateRouteMetrics(coordinates);
    const { totalDistance } = metrics;

    return fuel_calculator.calculateFuelConsumption(
      totalDistance,
      vehicle_type_id,
      city as City
    );
  }, [fuel_calculator]);

  /**
   * Process route data into analytics summaries with fuel calculations
   */
  const process_analytics = useCallback(async (coordinates: RouteTracking[]) => {
    if (!coordinates || coordinates.length === 0) {
      return;
    }

    set_analytics_state(prev => ({ ...prev, is_loading: true, error: null }));

    try {
      // Process route analytics
      const daily_summaries = route_analyzer.analyzeDailyRoutes(coordinates, filters);
      const weekly_summaries = route_analyzer.analyzeWeeklyRoutes(daily_summaries);
      const monthly_summaries = route_analyzer.analyzeMonthlyRoutes(weekly_summaries);

      // Process fuel analytics
      const fuel_analytics = {
        daily: daily_summaries.map(summary => {
          const fuel_data = calculate_fuel_consumption(
            coordinates.filter(c => c.date === summary.date),
            filters.vehicle_type || 'standard-van',
            filters.city || 'Delhi'
          );
          return fuel_data ? { ...fuel_data, date: summary.date } : null;
        }).filter((item): item is FuelConsumptionResult & { date: string } => item !== null),
        weekly: weekly_summaries.map(summary => {
          const week_coordinates = coordinates.filter(c => {
            const date = new Date(c.date);
            const week_start = new Date(summary.week_start);
            const week_end = new Date(week_start);
            week_end.setDate(week_end.getDate() + 6);
            return date >= week_start && date <= week_end;
          });
          const fuel_data = calculate_fuel_consumption(
            week_coordinates,
            filters.vehicle_type || 'standard-van',
            filters.city || 'Delhi'
          );
          return fuel_data ? { ...fuel_data, week_start: summary.week_start } : null;
        }).filter((item): item is FuelConsumptionResult & { week_start: string } => item !== null),
        monthly: monthly_summaries.map(summary => {
          const [year, month] = summary.month.split('-');
          const month_start = new Date(parseInt(year), parseInt(month) - 1, 1);
          const month_end = new Date(parseInt(year), parseInt(month), 0);
          const month_coordinates = coordinates.filter(c => {
            const date = new Date(c.date);
            return date >= month_start && date <= month_end;
          });
          const fuel_data = calculate_fuel_consumption(
            month_coordinates,
            filters.vehicle_type || 'standard-van',
            filters.city || 'Delhi'
          );
          return fuel_data ? { ...fuel_data, month: summary.month } : null;
        }).filter((item): item is FuelConsumptionResult & { month: string } => item !== null)
      };

      // Generate optimization suggestions
      const total_distance = fuel_analytics.daily.reduce((sum, day) => sum + day.distance, 0);
      const total_fuel_consumed = fuel_analytics.daily.reduce((sum, day) => sum + day.fuel_consumed, 0);
      const total_fuel_cost = fuel_analytics.daily.reduce((sum, day) => sum + day.fuel_cost, 0);
      const total_co2_emissions = fuel_analytics.daily.reduce((sum, day) => sum + (day.co2_emissions || 0), 0);

      const average_efficiency = total_fuel_consumed > 0 ? total_distance / total_fuel_consumed : 0;
      const cost_per_km = total_distance > 0 ? total_fuel_cost / total_distance : 0;
      const fuel_per_km = total_distance > 0 ? total_fuel_consumed / total_distance : 0;

      const aggregated_analytics: FuelAnalytics = {
        total_distance,
        total_fuel_consumed,
        total_fuel_cost,
        total_co2_emissions,
        average_efficiency,
        cost_per_km,
        fuel_per_km,
        daily_breakdown: fuel_analytics.daily.map(day => ({
          date: day.date,
          fuel_consumed: day.fuel_consumed,
          fuel_cost: day.fuel_cost,
          distance: day.distance
        }))
      };

      const optimization_suggestions = fuel_calculator.generateFuelOptimizationSuggestions(
        aggregated_analytics
      );

      set_analytics_state(prev => ({
        ...prev,
        daily_summaries,
        weekly_summaries,
        monthly_summaries,
        fuel_analytics,
        optimization_suggestions,
        is_loading: false,
        last_updated: new Date()
      }));

    } catch (error) {
      console.error('Failed to process analytics:', error);
      set_analytics_state(prev => ({
        ...prev,
        is_loading: false,
        error: (error as Error).message
      }));
    }
  }, [route_analyzer, fuel_calculator, calculate_fuel_consumption, filters]);

  // Process analytics when route data changes
  useEffect(() => {
    if (route_data && !is_loading_routes) {
      process_analytics(route_data);
    }
  }, [route_data, is_loading_routes, process_analytics]);

  // Handle route loading errors
  useEffect(() => {
    if (route_error) {
      set_analytics_state(prev => ({
        ...prev,
        is_loading: false,
        error: (route_error as Error).message
      }));
    }
  }, [route_error]);

  /**
   * Get analytics for a specific employee
   */
  const get_employee_analytics = useCallback((employee_id: string) => {
    return {
      daily: analytics_state.daily_summaries.filter(summary => summary.employee_id === employee_id),
      weekly: analytics_state.weekly_summaries.filter(summary => summary.employee_id === employee_id),
      monthly: analytics_state.monthly_summaries.filter(summary => summary.employee_id === employee_id),
      fuel: {
        daily: analytics_state.fuel_analytics.daily.filter((_, index) =>
          analytics_state.daily_summaries[index]?.employee_id === employee_id
        ),
        weekly: analytics_state.fuel_analytics.weekly.filter((_, index) =>
          analytics_state.weekly_summaries[index]?.employee_id === employee_id
        )
      }
    };
  }, [analytics_state]);

  /**
   * Get analytics for a specific date range
   */
  const get_date_range_analytics = useCallback((start_date: string, end_date: string) => {
    return {
      daily: analytics_state.daily_summaries.filter(summary =>
        summary.date >= start_date && summary.date <= end_date
      ),
      weekly: analytics_state.weekly_summaries.filter(summary =>
        summary.week_start >= start_date && summary.week_end !== undefined && summary.week_end <= end_date
      ),
      monthly: analytics_state.monthly_summaries.filter(summary => {
        const monthStart = `${summary.month}-01`;
        const monthEnd = getLastDayOfMonth(summary.month);
        return monthStart >= start_date && monthEnd <= end_date;
      }),
      fuel: {
        daily: analytics_state.fuel_analytics.daily.filter((_, index) => {
          const summary = analytics_state.daily_summaries[index];
          return summary && summary.date >= start_date && summary.date <= end_date;
        }),
        weekly: analytics_state.fuel_analytics.weekly.filter((_, index) => {
          const summary = analytics_state.weekly_summaries[index];
          return summary && summary.week_start >= start_date &&
            summary.week_end !== undefined &&
            summary.week_end <= end_date;
        })
      }
    };
  }, [analytics_state]);

  /**
   * Calculate aggregated metrics across all data
   */
  const get_aggregated_metrics = useCallback(() => {
    const { daily_summaries, fuel_analytics } = analytics_state;

    if (daily_summaries.length === 0) {
      return {
        total_distance: 0,
        total_time: 0,
        total_fuel_consumed: 0,
        total_fuel_cost: 0,
        total_shipments_completed: 0,
        average_efficiency: 0,
        average_speed: 0,
        total_sessions: 0,
        total_co2_emissions: 0,
        cost_per_km: 0
      };
    }

    const total_distance = daily_summaries.reduce((sum, day) => sum + day.total_distance, 0);
    const total_time = daily_summaries.reduce((sum, day) => sum + day.total_time, 0);
    const total_shipments_completed = daily_summaries.reduce((sum, day) => sum + day.shipments_completed, 0);
    const total_sessions = daily_summaries.reduce((sum, day) => sum + (day.total_sessions ?? 0), 0);

    const total_fuel_consumed = fuel_analytics.daily.reduce((sum, day) => sum + (day?.fuel_consumed ?? 0), 0);
    const total_fuel_cost = fuel_analytics.daily.reduce((sum, day) => sum + (day?.fuel_cost ?? 0), 0);
    const total_co2_emissions = fuel_analytics.daily.reduce((sum, day) => sum + (day?.co2_emissions ?? 0), 0);

    const average_efficiency = total_fuel_consumed > 0 ? total_distance / total_fuel_consumed : 0;
    const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;
    const cost_per_km = total_distance > 0 ? total_fuel_cost / total_distance : 0;

    return {
      total_distance: Math.round(total_distance * 100) / 100,
      total_time,
      total_fuel_consumed: Math.round(total_fuel_consumed * 100) / 100,
      total_fuel_cost: Math.round(total_fuel_cost * 100) / 100,
      total_co2_emissions: Math.round(total_co2_emissions * 100) / 100,
      total_shipments_completed,
      average_efficiency: Math.round(average_efficiency * 100) / 100,
      average_speed: Math.round(average_speed * 100) / 100,
      cost_per_km: Math.round(cost_per_km * 100) / 100,
      total_sessions
    };
  }, [analytics_state]);

  /**
   * Get vehicle types from fuel calculator
   */
  const get_vehicle_types = useCallback((): VehicleType[] => {
    return fuel_calculator.getVehicleTypes();
  }, [fuel_calculator]);

  /**
   * Update vehicle type in fuel calculator
   */
  const update_vehicle_type = useCallback((vehicle_type: VehicleType) => {
    fuel_calculator.addVehicleType(vehicle_type);
    console.log('Vehicle type updated successfully');
  }, [fuel_calculator]);

  /**
   * Update fuel price
   */
  const update_fuel_price = useCallback((fuel_price: FuelPrice) => {
    fuel_calculator.updateFuelPrice(fuel_price);
    console.log('Fuel price updated successfully');
  }, [fuel_calculator]);

  /**
   * Generate fleet report
   */
  const generate_fleet_report = useCallback(() => {
    const { daily_summaries, fuel_analytics } = analytics_state;

    if (daily_summaries.length === 0 || fuel_analytics.daily.length === 0) {
      return [];
    }

    return daily_summaries.map((summary, index) => {
      const fuel_data = fuel_analytics.daily[index] || {};
      return {
        date: summary.date,
        vehicle_type: filters.vehicle_type || 'standard-van',
        city: filters.city || 'Delhi',
        distance: summary.total_distance,
        fuel_consumed: fuel_data.fuel_consumed || 0,
        fuel_cost: fuel_data.fuel_cost || 0,
        co2_emissions: fuel_data.co2_emissions || 0,
        efficiency: fuel_data.efficiency || 0,
        cost_per_km: summary.total_distance > 0 ? (fuel_data.fuel_cost || 0) / summary.total_distance : 0
      };
    });
  }, [analytics_state, filters.vehicle_type, filters.city]);

  /**
   * Export fleet report
   */
  const export_fleet_report = useCallback((format: 'csv' | 'pdf' = 'csv') => {
    const report_data = generate_fleet_report();

    if (report_data.length === 0) {
      console.warn('No data available to export');
      return;
    }

    // In a real app, this would generate and download the file
    console.log(`Exporting ${report_data.length} records as ${format.toUpperCase()}`, report_data);
  }, [generate_fleet_report]);

  /**
   * Refresh analytics data
   */
  const refresh_analytics = useCallback(() => {
    refetch_routes();
  }, [refetch_routes]);

  return {
    // State
    ...analytics_state,

    // Data access
    getEmployeeAnalytics: get_employee_analytics,
    getDateRangeAnalytics: get_date_range_analytics,
    getAggregatedMetrics: get_aggregated_metrics,
    getOptimizationSuggestions: () => analytics_state.optimization_suggestions,
    compareEmployees: () => route_analyzer.compareEmployeePerformance(analytics_state.daily_summaries),

    // Configuration
    getVehicleTypes: get_vehicle_types,
    updateVehicleType: update_vehicle_type,
    updateFuelPrice: update_fuel_price,

    // Reports
    generateFleetReport: generate_fleet_report,
    exportFleetReport: export_fleet_report,

    // Actions
    refreshAnalytics: refresh_analytics,

    // Loading state
    isLoading: analytics_state.is_loading || is_loading_routes
  };
}

// Helper functions
function getLastDayOfMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${month}-${lastDay.toString().padStart(2, '0')}`;
}