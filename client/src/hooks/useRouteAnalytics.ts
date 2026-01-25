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
  dailySummaries: DailyRouteSummary[];
  weeklySummaries: WeeklyRouteSummary[];
  monthlySummaries: MonthlyRouteSummary[];
  fuelAnalytics: {
    daily: Array<FuelConsumptionResult & { date: string }>;
    weekly: Array<FuelConsumptionResult & { weekStart: string }>;
    monthly: Array<FuelConsumptionResult & { month: string }>;
  };
  optimizationSuggestions: FuelOptimizationSuggestion[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useRouteAnalytics(filters: AnalyticsFilters = {}) {
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>({
    dailySummaries: [],
    weeklySummaries: [],
    monthlySummaries: [],
    fuelAnalytics: {
      daily: [],
      weekly: [],
      monthly: []
    },
    optimizationSuggestions: [],
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  // Initialize analyzers
  const routeAnalyzer = useMemo(() => new RouteAnalyzer(), []);
  const fuelCalculator = useMemo(() => new FuelCalculator(), []);

  // Fetch route tracking data
  const routeFilters: RouteFilters = useMemo(() => ({
    employeeId: filters.employeeId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    city: filters.city,
    vehicleType: filters.vehicleType
  }), [filters.employeeId, filters.startDate, filters.endDate, filters.city, filters.vehicleType]);

  const {
    data: routeData,
    isLoading: isLoadingRoutes,
    error: routeError,
    refetch: refetchRoutes
  } = useQuery({
    queryKey: ['route-analytics', routeFilters],
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
  const calculateFuelConsumption = useCallback((
    coordinates: RouteTracking[],
    vehicleTypeId: string,
    city: string
  ): FuelConsumptionResult | null => {
    if (!coordinates || coordinates.length === 0) return null;

    const metrics = DistanceCalculator.calculateRouteMetrics(coordinates);
    const { totalDistance } = metrics;

    return fuelCalculator.calculateFuelConsumption(
      totalDistance,
      vehicleTypeId,
      city as City
    );
  }, [fuelCalculator]);

  /**
   * Process route data into analytics summaries with fuel calculations
   */
  const processAnalytics = useCallback(async (coordinates: RouteTracking[]) => {
    if (!coordinates || coordinates.length === 0) {
      return;
    }

    setAnalyticsState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Process route analytics
      const dailySummaries = routeAnalyzer.analyzeDailyRoutes(coordinates, filters);
      const weeklySummaries = routeAnalyzer.analyzeWeeklyRoutes(dailySummaries);
      const monthlySummaries = routeAnalyzer.analyzeMonthlyRoutes(weeklySummaries);

      // Process fuel analytics
      const fuelAnalytics = {
        daily: dailySummaries.map(summary => {
          const fuelData = calculateFuelConsumption(
            coordinates.filter(c => c.date === summary.date),
            filters.vehicleType || 'standard-van',
            filters.city || 'Delhi'
          );
          return fuelData ? { ...fuelData, date: summary.date } : null;
        }).filter((item): item is FuelConsumptionResult & { date: string } => item !== null),
        weekly: weeklySummaries.map(summary => {
          const weekCoordinates = coordinates.filter(c => {
            const date = new Date(c.date);
            const weekStart = new Date(summary.weekStart);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            return date >= weekStart && date <= weekEnd;
          });
          const fuelData = calculateFuelConsumption(
            weekCoordinates,
            filters.vehicleType || 'standard-van',
            filters.city || 'Delhi'
          );
          return fuelData ? { ...fuelData, weekStart: summary.weekStart } : null;
        }).filter((item): item is FuelConsumptionResult & { weekStart: string } => item !== null),
        monthly: monthlySummaries.map(summary => {
          const [year, month] = summary.month.split('-');
          const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
          const monthEnd = new Date(parseInt(year), parseInt(month), 0);
          const monthCoordinates = coordinates.filter(c => {
            const date = new Date(c.date);
            return date >= monthStart && date <= monthEnd;
          });
          const fuelData = calculateFuelConsumption(
            monthCoordinates,
            filters.vehicleType || 'standard-van',
            filters.city || 'Delhi'
          );
          return fuelData ? { ...fuelData, month: summary.month } : null;
        }).filter((item): item is FuelConsumptionResult & { month: string } => item !== null)
      };

      // Generate optimization suggestions
      const totalDistance = fuelAnalytics.daily.reduce((sum, day) => sum + day.distance, 0);
      const totalFuelConsumed = fuelAnalytics.daily.reduce((sum, day) => sum + day.fuelConsumed, 0);
      const totalFuelCost = fuelAnalytics.daily.reduce((sum, day) => sum + day.fuelCost, 0);
      const totalCO2Emissions = fuelAnalytics.daily.reduce((sum, day) => sum + (day.co2Emissions || 0), 0);
      
      const averageEfficiency = totalFuelConsumed > 0 ? totalDistance / totalFuelConsumed : 0;
      const costPerKm = totalDistance > 0 ? totalFuelCost / totalDistance : 0;
      const fuelPerKm = totalDistance > 0 ? totalFuelConsumed / totalDistance : 0;

      const aggregatedAnalytics: FuelAnalytics = {
        totalDistance,
        totalFuelConsumed,
        totalFuelCost,
        totalCO2Emissions,
        averageEfficiency,
        costPerKm,
        fuelPerKm,
        dailyBreakdown: fuelAnalytics.daily.map(day => ({
            date: day.date,
            fuelConsumed: day.fuelConsumed,
            fuelCost: day.fuelCost,
            distance: day.distance
        }))
      };

      const optimizationSuggestions = fuelCalculator.generateFuelOptimizationSuggestions(
        aggregatedAnalytics
      );

      setAnalyticsState(prev => ({
        ...prev,
        dailySummaries,
        weeklySummaries,
        monthlySummaries,
        fuelAnalytics,
        optimizationSuggestions,
        isLoading: false,
        lastUpdated: new Date()
      }));

    } catch (error) {
      console.error('Failed to process analytics:', error);
      setAnalyticsState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
    }
  }, [routeAnalyzer, fuelCalculator, calculateFuelConsumption, filters]);

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
      monthly: analyticsState.monthlySummaries.filter(summary => summary.employeeId === employeeId),
      fuel: {
        daily: analyticsState.fuelAnalytics.daily.filter((_, index) => 
          analyticsState.dailySummaries[index]?.employeeId === employeeId
        ),
        weekly: analyticsState.fuelAnalytics.weekly.filter((_, index) => 
          analyticsState.weeklySummaries[index]?.employeeId === employeeId
        )
      }
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
        summary.weekStart >= startDate && summary.weekEnd !== undefined && summary.weekEnd <= endDate
      ),
      monthly: analyticsState.monthlySummaries.filter(summary => {
        const monthStart = `${summary.month}-01`;
        const monthEnd = getLastDayOfMonth(summary.month);
        return monthStart >= startDate && monthEnd <= endDate;
      }),
      fuel: {
        daily: analyticsState.fuelAnalytics.daily.filter((_, index) => {
          const summary = analyticsState.dailySummaries[index];
          return summary && summary.date >= startDate && summary.date <= endDate;
        }),
        weekly: analyticsState.fuelAnalytics.weekly.filter((_, index) => {
          const summary = analyticsState.weeklySummaries[index];
          return summary && summary.weekStart >= startDate && 
            summary.weekEnd !== undefined && 
            summary.weekEnd <= endDate;
        })
      }
    };
  }, [analyticsState]);

  /**
   * Calculate aggregated metrics across all data
   */
  const getAggregatedMetrics = useCallback(() => {
    const { dailySummaries, fuelAnalytics } = analyticsState;

    if (dailySummaries.length === 0) {
      return {
        totalDistance: 0,
        totalTime: 0,
        totalFuelConsumed: 0,
        totalFuelCost: 0,
        totalShipmentsCompleted: 0,
        averageEfficiency: 0,
        averageSpeed: 0,
        totalSessions: 0,
        totalCO2Emissions: 0,
        costPerKm: 0
      };
    }

    const totalDistance = dailySummaries.reduce((sum, day) => sum + day.totalDistance, 0);
    const totalTime = dailySummaries.reduce((sum, day) => sum + day.totalTime, 0);
    const totalShipmentsCompleted = dailySummaries.reduce((sum, day) => sum + day.shipmentsCompleted, 0);
    const totalSessions = dailySummaries.reduce((sum, day) => sum + (day.totalSessions ?? 0), 0);
    
    const totalFuelConsumed = fuelAnalytics.daily.reduce((sum, day) => sum + (day?.fuelConsumed ?? 0), 0);
    const totalFuelCost = fuelAnalytics.daily.reduce((sum, day) => sum + (day?.fuelCost ?? 0), 0);
    const totalCO2Emissions = fuelAnalytics.daily.reduce((sum, day) => sum + (day?.co2Emissions ?? 0), 0);

    const averageEfficiency = totalFuelConsumed > 0 ? totalDistance / totalFuelConsumed : 0;
    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
    const costPerKm = totalDistance > 0 ? totalFuelCost / totalDistance : 0;

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime,
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      totalCO2Emissions: Math.round(totalCO2Emissions * 100) / 100,
      totalShipmentsCompleted,
      averageEfficiency: Math.round(averageEfficiency * 100) / 100,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      costPerKm: Math.round(costPerKm * 100) / 100,
      totalSessions
    };
  }, [analyticsState]);

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
    console.log('Vehicle type updated successfully');
  }, [fuelCalculator]);

  /**
   * Update fuel price
   */
  const updateFuelPrice = useCallback((fuelPrice: FuelPrice) => {
    fuelCalculator.updateFuelPrice(fuelPrice);
    console.log('Fuel price updated successfully');
  }, [fuelCalculator]);

  /**
   * Generate fleet report
   */
  const generateFleetReport = useCallback(() => {
    const { dailySummaries, fuelAnalytics } = analyticsState;
    
    if (dailySummaries.length === 0 || fuelAnalytics.daily.length === 0) {
      return [];
    }

    return dailySummaries.map((summary, index) => {
      const fuelData = fuelAnalytics.daily[index] || {};
      return {
        date: summary.date,
        vehicleType: filters.vehicleType || 'standard-van',
        city: filters.city || 'Delhi',
        distance: summary.totalDistance,
        fuelConsumed: fuelData.fuelConsumed || 0,
        fuelCost: fuelData.fuelCost || 0,
        co2Emissions: fuelData.co2Emissions || 0,
        efficiency: fuelData.efficiency || 0,
        costPerKm: summary.totalDistance > 0 ? (fuelData.fuelCost || 0) / summary.totalDistance : 0
      };
    });
  }, [analyticsState, filters.vehicleType, filters.city]);

  /**
   * Export fleet report
   */
  const exportFleetReport = useCallback((format: 'csv' | 'pdf' = 'csv') => {
    const reportData = generateFleetReport();
    
    if (reportData.length === 0) {
      console.warn('No data available to export');
      return;
    }

    // In a real app, this would generate and download the file
    console.log(`Exporting ${reportData.length} records as ${format.toUpperCase()}`, reportData);
  }, [generateFleetReport]);

  /**
   * Refresh analytics data
   */
  const refreshAnalytics = useCallback(() => {
    refetchRoutes();
  }, [refetchRoutes]);

  return {
    // State
    ...analyticsState,

    // Data access
    getEmployeeAnalytics,
    getDateRangeAnalytics,
    getAggregatedMetrics,
    getOptimizationSuggestions: () => analyticsState.optimizationSuggestions,
    compareEmployees: () => routeAnalyzer.compareEmployeePerformance(analyticsState.dailySummaries),

    // Configuration
    getVehicleTypes,
    updateVehicleType,
    updateFuelPrice,

    // Reports
    generateFleetReport,
    exportFleetReport,

    // Actions
    refreshAnalytics,

    // Loading state
    isLoading: analyticsState.isLoading || isLoadingRoutes
  };
}

// Helper functions
function getLastDayOfMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${month}-${lastDay.toString().padStart(2, '0')}`;
}