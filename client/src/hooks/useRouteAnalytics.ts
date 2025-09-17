import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { routeAPI } from '@/api/routes';
import { RouteAnalyzer, DailyRouteSummary, WeeklyRouteSummary, MonthlyRouteSummary, FuelSettings } from '../services/RouteAnalyzer';
import { FuelCalculator, VehicleType, FuelPrice } from '../services/FuelCalculator';
import { DistanceCalculator } from '../services/DistanceCalculator';
import { RouteTracking, RouteFilters } from '@shared/schema';

export interface AnalyticsFilters {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  vehicleType?: string;
}

export interface AnalyticsState {
  dailySummaries: DailyRouteSummary[];
  weeklySummaries: WeeklyRouteSummary[];
  monthlySummaries: MonthlyRouteSummary[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useRouteAnalytics(filters: AnalyticsFilters = {}) {
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>({
    dailySummaries: [],
    weeklySummaries: [],
    monthlySummaries: [],
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  const [fuelSettings, setFuelSettings] = useState<FuelSettings>({
    vehicleType: 'standard-van',
    fuelEfficiency: 15.0,
    fuelPrice: 1.5
  });

  // Initialize analyzers
  const routeAnalyzer = useMemo(() => new RouteAnalyzer(fuelSettings), [fuelSettings]);
  const fuelCalculator = useMemo(() => new FuelCalculator(), []);

  // Fetch route tracking data
  const routeFilters: RouteFilters = useMemo(() => ({
    employeeId: filters.employeeId,
    startDate: filters.startDate,
    endDate: filters.endDate
  }), [filters.employeeId, filters.startDate, filters.endDate]);

  const {
    data: routeData,
    isLoading: isLoadingRoutes,
    error: routeError,
    refetch: refetchRoutes
  } = useQuery({
    queryKey: ['route-analytics', routeFilters],
    queryFn: () => routeAPI.getSessionCoordinates('all'), // This would need to be updated to fetch all coordinates
    enabled: true,
    refetchInterval: 300000, // 5 minutes
  });

  /**
   * Process route data into analytics summaries
   */
  const processAnalytics = useCallback(async (coordinates: RouteTracking[]) => {
    if (!coordinates || coordinates.length === 0) {
      return;
    }

    setAnalyticsState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const dailySummaries: DailyRouteSummary[] = [];
      const weeklySummaries: WeeklyRouteSummary[] = [];
      const monthlySummaries: MonthlyRouteSummary[] = [];

      // Get unique employee IDs and date ranges
      const employeeIds = Array.from(new Set(coordinates.map(coord => coord.employeeId)));
      const dates = Array.from(new Set(coordinates.map(coord => coord.date))).sort();

      // Filter by employee if specified
      const targetEmployees = filters.employeeId ? [filters.employeeId] : employeeIds;

      // Process daily summaries
      for (const employeeId of targetEmployees) {
        for (const date of dates) {
          if (filters.startDate && date < filters.startDate) continue;
          if (filters.endDate && date > filters.endDate) continue;

          const dailySummary = routeAnalyzer.analyzeDailyRoutes(
            coordinates,
            employeeId,
            date,
            fuelSettings
          );

          if (dailySummary.totalSessions > 0) {
            dailySummaries.push(dailySummary);
          }
        }
      }

      // Process weekly summaries
      const weeks = getWeekRanges(dates);
      for (const employeeId of targetEmployees) {
        for (const weekStart of weeks) {
          const weeklySummary = routeAnalyzer.analyzeWeeklyRoutes(
            coordinates,
            employeeId,
            weekStart,
            fuelSettings
          );

          if (weeklySummary.dailySummaries.length > 0) {
            weeklySummaries.push(weeklySummary);
          }
        }
      }

      // Process monthly summaries
      const months = getMonthRanges(dates);
      for (const employeeId of targetEmployees) {
        for (const month of months) {
          const monthlySummary = routeAnalyzer.analyzeMonthlyRoutes(
            coordinates,
            employeeId,
            month,
            fuelSettings
          );

          if (monthlySummary.weeklySummaries.length > 0) {
            monthlySummaries.push(monthlySummary);
          }
        }
      }

      setAnalyticsState({
        dailySummaries,
        weeklySummaries,
        monthlySummaries,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('Failed to process analytics:', error);
      setAnalyticsState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
    }
  }, [routeAnalyzer, fuelSettings, filters]);

  // Process analytics when route data changes
  useEffect(() => {
    if (routeData && !isLoadingRoutes) {
      processAnalytics(routeData);
    }
  }, [routeData, isLoadingRoutes, processAnalytics]);

  // Handle route loading errors
  useEffect(() => {
    if (routeError) {
      setAnalyticsState(prev => ({
        ...prev,
        isLoading: false,
        error: (routeError as Error).message
      }));
    }
  }, [routeError]);

  /**
   * Get analytics for a specific employee
   */
  const getEmployeeAnalytics = useCallback((employeeId: string) => {
    return {
      daily: analyticsState.dailySummaries.filter(summary => summary.employeeId === employeeId),
      weekly: analyticsState.weeklySummaries.filter(summary => summary.employeeId === employeeId),
      monthly: analyticsState.monthlySummaries.filter(summary => summary.employeeId === employeeId)
    };
  }, [analyticsState]);

  /**
   * Get analytics for a specific date range
   */
  const getDateRangeAnalytics = useCallback((startDate: string, endDate: string) => {
    return {
      daily: analyticsState.dailySummaries.filter(summary =>
        summary.date >= startDate && summary.date <= endDate
      ),
      weekly: analyticsState.weeklySummaries.filter(summary =>
        summary.weekStart >= startDate && summary.weekEnd <= endDate
      ),
      monthly: analyticsState.monthlySummaries.filter(summary => {
        const monthStart = `${summary.month}-01`;
        const monthEnd = getLastDayOfMonth(summary.month);
        return monthStart >= startDate && monthEnd <= endDate;
      })
    };
  }, [analyticsState]);

  /**
   * Calculate aggregated metrics across all data
   */
  const getAggregatedMetrics = useCallback(() => {
    const { dailySummaries } = analyticsState;

    if (dailySummaries.length === 0) {
      return {
        totalDistance: 0,
        totalTime: 0,
        totalFuelConsumed: 0,
        totalFuelCost: 0,
        totalShipmentsCompleted: 0,
        averageEfficiency: 0,
        averageSpeed: 0,
        totalSessions: 0
      };
    }

    const totalDistance = dailySummaries.reduce((sum, day) => sum + day.totalDistance, 0);
    const totalTime = dailySummaries.reduce((sum, day) => sum + day.totalTime, 0);
    const totalFuelConsumed = dailySummaries.reduce((sum, day) => sum + day.totalFuelConsumed, 0);
    const totalFuelCost = dailySummaries.reduce((sum, day) => sum + day.totalFuelCost, 0);
    const totalShipmentsCompleted = dailySummaries.reduce((sum, day) => sum + day.shipmentsCompleted, 0);
    const totalSessions = dailySummaries.reduce((sum, day) => sum + day.totalSessions, 0);

    const averageEfficiency = totalShipmentsCompleted > 0 ? totalDistance / totalShipmentsCompleted : 0;
    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime,
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      totalShipmentsCompleted,
      averageEfficiency: Math.round(averageEfficiency * 100) / 100,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      totalSessions
    };
  }, [analyticsState]);

  /**
   * Generate optimization suggestions
   */
  const getOptimizationSuggestions = useCallback((employeeId?: string) => {
    const targetSummaries = employeeId
      ? analyticsState.dailySummaries.filter(summary => summary.employeeId === employeeId)
      : analyticsState.dailySummaries;

    const suggestions = targetSummaries.flatMap(summary =>
      routeAnalyzer.generateOptimizationSuggestions(summary)
    );

    // Group suggestions by type and severity
    const grouped = suggestions.reduce((acc, suggestion) => {
      const key = `${suggestion.type}-${suggestion.severity}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(suggestion);
      return acc;
    }, {} as Record<string, typeof suggestions>);

    return {
      all: suggestions,
      grouped,
      highPriority: suggestions.filter(s => s.severity === 'high'),
      byType: {
        distance: suggestions.filter(s => s.type === 'distance'),
        time: suggestions.filter(s => s.type === 'time'),
        fuel: suggestions.filter(s => s.type === 'fuel'),
        efficiency: suggestions.filter(s => s.type === 'efficiency')
      }
    };
  }, [analyticsState.dailySummaries, routeAnalyzer]);

  /**
   * Compare employee performance
   */
  const compareEmployees = useCallback(() => {
    return routeAnalyzer.compareEmployeePerformance(analyticsState.dailySummaries);
  }, [analyticsState.dailySummaries, routeAnalyzer]);

  /**
   * Update fuel settings
   */
  const updateFuelSettings = useCallback((newSettings: Partial<FuelSettings>) => {
    setFuelSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  /**
   * Get vehicle types from fuel calculator
   */
  const getVehicleTypes = useCallback((): VehicleType[] => {
    return fuelCalculator.getVehicleTypes();
  }, [fuelCalculator]);

  /**
   * Update vehicle type in fuel calculator
   */
  const updateVehicleType = useCallback((vehicleType: VehicleType) => {
    fuelCalculator.addVehicleType(vehicleType);
  }, [fuelCalculator]);

  /**
   * Update fuel price
   */
  const updateFuelPrice = useCallback((fuelPrice: FuelPrice) => {
    fuelCalculator.updateFuelPrice(fuelPrice);
  }, [fuelCalculator]);

  /**
   * Refresh analytics data
   */
  const refreshAnalytics = useCallback(() => {
    refetchRoutes();
  }, [refetchRoutes]);

  return {
    // State
    ...analyticsState,
    fuelSettings,

    // Data access
    getEmployeeAnalytics,
    getDateRangeAnalytics,
    getAggregatedMetrics,
    getOptimizationSuggestions,
    compareEmployees,

    // Configuration
    updateFuelSettings,
    getVehicleTypes,
    updateVehicleType,
    updateFuelPrice,

    // Actions
    refreshAnalytics,

    // Loading state
    isLoading: analyticsState.isLoading || isLoadingRoutes
  };
}

/**
 * Hook for real-time route metrics calculation
 */
export function useRealTimeMetrics(coordinates: RouteTracking[]) {
  const [metrics, setMetrics] = useState({
    totalDistance: 0,
    averageSpeed: 0,
    currentSpeed: 0,
    maxSpeed: 0,
    duration: 0,
    coordinateCount: 0
  });

  useEffect(() => {
    if (coordinates.length < 2) {
      setMetrics({
        totalDistance: 0,
        averageSpeed: 0,
        currentSpeed: 0,
        maxSpeed: 0,
        duration: 0,
        coordinateCount: coordinates.length
      });
      return;
    }

    const result = DistanceCalculator.calculateRouteMetrics(coordinates);
    const currentSpeed = coordinates.length >= 2
      ? DistanceCalculator.calculateRouteSegments(coordinates.slice(-2))[0]?.speed || 0
      : 0;

    setMetrics({
      totalDistance: result.totalDistance,
      averageSpeed: result.averageSpeed,
      currentSpeed: Math.round(currentSpeed * 100) / 100,
      maxSpeed: result.maxSpeed,
      duration: result.totalTime,
      coordinateCount: coordinates.length
    });
  }, [coordinates]);

  return metrics;
}

// Helper functions

function getWeekRanges(dates: string[]): string[] {
  if (dates.length === 0) return [];

  const weeks = new Set<string>();
  dates.forEach(date => {
    const weekStart = getWeekStart(date);
    weeks.add(weekStart);
  });

  return Array.from(weeks).sort();
}

function getMonthRanges(dates: string[]): string[] {
  if (dates.length === 0) return [];

  const months = new Set<string>();
  dates.forEach(date => {
    const month = date.substring(0, 7); // YYYY-MM
    months.add(month);
  });

  return Array.from(months).sort();
}

function getWeekStart(dateString: string): string {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = Sunday
  date.setDate(date.getDate() - daysToMonday);
  return date.toISOString().split('T')[0];
}

function getLastDayOfMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${month}-${lastDay.toString().padStart(2, '0')}`;
}