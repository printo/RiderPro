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
  potentialSaving: {
    distance?: number; // km
    time?: number; // minutes
    fuel?: number; // liters
    cost?: number; // currency
  };
  recommendation: string;
}

export class RouteAnalyzer {
  private fuelCalculator: FuelCalculator;

  /**
   * Get the start of the week (Monday) for a given date string
   */
  private getWeekStart(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDay();
    // Adjust to get Monday as the first day of the week
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
  }

  /**
   * Add days to a date string and return the new date string
   */
  private addDays(dateString: string, days: number): string {
    const date = new Date(dateString);
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
    const sortedCoords = [...coordinates].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const sessions: RouteTracking[][] = [];
    let currentSession: RouteTracking[] = [];
    let currentSessionId = sortedCoords[0]?.sessionId;

    for (const coord of sortedCoords) {
      if (coord.sessionId !== currentSessionId) {
        if (currentSession.length > 0) {
          sessions.push(currentSession);
        }
        currentSession = [coord];
        currentSessionId = coord.sessionId;
      } else {
        currentSession.push(coord);
      }
    }

    // Add the last session
    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    return sessions;
  }

  /**
   * Create an empty session summary
   */
  private createEmptySessionSummary(sessionId: string, employeeId: string): RouteSessionSummary {
    const now = new Date().toISOString();
    return {
      sessionId,
      employeeId,
      startTime: now,
      endTime: now,
      distance: 0,
      duration: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      fuelConsumed: 0,
      fuelCost: 0,
      shipmentsCompleted: 0,
      coordinateCount: 0,
      efficiency: 0
    };
  }

  constructor() {
    this.fuelCalculator = new FuelCalculator();
  }

  /**
   * Analyze route data for a single session
   */
  analyzeRouteSession(
    coordinates: RouteTracking[],
    vehicleTypeId: string = 'standard-van',
    city: string = 'Delhi'
  ): RouteSessionSummary {
    if (!coordinates || coordinates.length === 0) {
      throw new Error('No coordinates provided for analysis');
    }

    const sessionId = coordinates[0].sessionId;
    const employeeId = coordinates[0].employeeId || '';
    
    // Filter coordinates for this session only
    const sessionCoords = coordinates.filter(coord => coord.sessionId === sessionId);
    if (sessionCoords.length < 2) {
      return this.createEmptySessionSummary(sessionId, employeeId);
    }

    // Calculate route metrics
    const metrics = DistanceCalculator.calculateRouteMetrics(sessionCoords);
    
    // Count shipments completed
    const shipmentsCompleted = new Set(
      sessionCoords
        .filter(coord => coord.shipmentId && coord.eventType)
        .map(coord => coord.shipmentId as string)
    ).size;
    
    // Initialize default fuel result
    const defaultFuelResult: FuelConsumptionResult = { 
      distance: 0,
      fuelConsumed: 0, 
      fuelCost: 0, 
      formattedCost: '₹0.00',
      co2Emissions: 0, 
      efficiency: 0 
    };
    
    // Calculate fuel consumption if there's distance
    const fuelResult = metrics.totalDistance > 0 
      ? this.fuelCalculator.calculateFuelConsumption(
          metrics.totalDistance,
          vehicleTypeId,
          city as City,
          {
            trafficFactor: 1.0,
            weatherFactor: 1.0,
            loadFactor: 1.0,
            drivingStyle: 'normal'
          }
        )
      : defaultFuelResult;

    // Calculate efficiency (km per shipment)
    const efficiency = shipmentsCompleted > 0 
      ? metrics.totalDistance / shipmentsCompleted 
      : 0;

    // Create and return the session summary
    return {
      sessionId,
      employeeId,
      startTime: sessionCoords[0].timestamp,
      endTime: sessionCoords[sessionCoords.length - 1].timestamp,
      distance: Math.round(metrics.totalDistance * 100) / 100,
      duration: metrics.totalTime,
      averageSpeed: Math.round(metrics.averageSpeed * 100) / 100,
      maxSpeed: Math.round(metrics.maxSpeed * 100) / 100,
      fuelConsumed: Math.round((fuelResult?.fuelConsumed || 0) * 100) / 100,
      fuelCost: Math.round((fuelResult?.fuelCost || 0) * 100) / 100,
      shipmentsCompleted,
      coordinateCount: sessionCoords.length,
      efficiency: Math.round(efficiency * 100) / 100
    } as RouteSessionSummary;
  }

  /**
   * Analyze daily route data
   */
  analyzeDailyRoutes(
    coordinates: RouteTracking[],
    filters: {
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      city?: string;
      vehicleType?: string;
    } = {}
  ): DailyRouteSummary[] {
    if (!coordinates || coordinates.length === 0) {
      return [];
    }

    // Filter coordinates based on filters
    const filteredCoords = coordinates.filter(coord => {
      if (filters.employeeId && coord.employeeId !== filters.employeeId) {
        return false;
      }
      if (filters.startDate && coord.timestamp < filters.startDate) {
        return false;
      }
      if (filters.endDate && coord.timestamp > filters.endDate) {
        return false;
      }
      if (filters.city && (coord as unknown as { city?: string }).city !== filters.city) {
        return false;
      }
      return true;
    });

    if (filteredCoords.length === 0) {
      return [];
    }

    // Group coordinates by date (YYYY-MM-DD)
    const dateGroups = filteredCoords.reduce<Record<string, RouteTracking[]>>((groups, coord) => {
      const date = coord.timestamp.split('T')[0]; // Extract YYYY-MM-DD from ISO string
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(coord);
      return groups;
    }, {});

    // Process each date group
    return Object.entries(dateGroups).map(([date, dateCoords]) => {
      // Get employee ID from first coordinate (assuming all coords for a date are from the same employee)
      const employeeId = dateCoords[0]?.employeeId || '';
      
      // Group by session
      const sessionGroups = this.groupCoordinatesBySession(dateCoords);
      const sessions: RouteSessionSummary[] = [];

      let totalDistance = 0;
      let totalTime = 0;
      let totalFuelConsumed = 0;
      let totalFuelCost = 0;
      let totalShipmentsCompleted = 0;
      let maxSpeed = 0;
      let coordinateCount = 0;

      // Analyze each session
      for (const sessionCoords of sessionGroups) {
        if (sessionCoords.length >= 2) {
          const sessionSummary = this.analyzeRouteSession(
            sessionCoords,
            filters.vehicleType || 'standard-van',
            filters.city || 'Delhi'
          );
          sessions.push(sessionSummary);

          // Aggregate metrics
          totalDistance += sessionSummary.distance || 0;
          totalTime += sessionSummary.duration || 0;
          totalFuelConsumed += sessionSummary.fuelConsumed || 0;
          totalFuelCost += sessionSummary.fuelCost || 0;
          totalShipmentsCompleted += sessionSummary.shipmentsCompleted || 0;
          maxSpeed = Math.max(maxSpeed, sessionSummary.maxSpeed || 0);
          coordinateCount += sessionSummary.coordinateCount || 0;
        }
      }

      // Calculate stationary time
      const stationaryPeriods = DistanceCalculator.findStationaryPeriods(dateCoords);
      const stationaryTime = stationaryPeriods.reduce(
        (sum, period) => sum + (period.duration * 60), 
        0
      );
      const movingTime = Math.max(0, totalTime - stationaryTime);

      // Calculate derived metrics
      const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
      const efficiency = totalShipmentsCompleted > 0 
        ? totalDistance / totalShipmentsCompleted 
        : 0;
      const fuelEfficiency = totalFuelConsumed > 0 
        ? totalDistance / totalFuelConsumed 
        : 0;

      // Create and return the daily summary
      return {
        employeeId,
        date,
        totalSessions: sessions.length,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
        fuelEfficiency: Math.round(fuelEfficiency * 100) / 100,
        shipmentsCompleted: totalShipmentsCompleted,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        stationaryTime,
        movingTime,
        maxSpeed: Math.round(maxSpeed * 100) / 100,
        coordinateCount,
        sessions
      } as DailyRouteSummary;
    });
  }

  /**
   * Analyze weekly route data
   */
  analyzeWeeklyRoutes(dailySummaries: DailyRouteSummary[]): WeeklyRouteSummary[] {
    if (!dailySummaries || dailySummaries.length === 0) {
      return [];
    }

    // Group daily summaries by week and employee
    const weekEmployeeGroups = dailySummaries.reduce<Record<string, {
      weekStart: string;
      employeeId: string;
      summaries: DailyRouteSummary[];
    }>>((groups, summary) => {
      const weekStart = this.getWeekStart(summary.date);
      const key = `${weekStart}_${summary.employeeId || 'unknown'}`;
      
      if (!groups[key]) {
        groups[key] = {
          weekStart,
          employeeId: summary.employeeId || '',
          summaries: []
        };
      }
      
      groups[key].summaries.push(summary);
      return groups;
    }, {});

    // Process each week-employee group
    return Object.values(weekEmployeeGroups).map(({ weekStart, employeeId, summaries }) => {
      const weekDailySummaries = summaries.sort((a, b) => a.date.localeCompare(b.date));
      const weekEnd = this.addDays(weekStart, 6);
      
      // Calculate weekly totals
      const totalDistance = weekDailySummaries.reduce((sum, day) => sum + (day.totalDistance || 0), 0);
      const totalTime = weekDailySummaries.reduce((sum, day) => sum + (day.totalTime || 0), 0);
      const totalFuelConsumed = weekDailySummaries.reduce((sum, day) => sum + (day.totalFuelConsumed || 0), 0);
      const totalFuelCost = weekDailySummaries.reduce((sum, day) => sum + (day.totalFuelCost || 0), 0);
      const totalShipmentsCompleted = weekDailySummaries.reduce((sum, day) => sum + (day.shipmentsCompleted || 0), 0);
      
      // Calculate working days (days with at least one session)
      const workingDays = weekDailySummaries.length;
      
      // Calculate derived metrics
      const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
      const efficiency = totalShipmentsCompleted > 0 
        ? totalDistance / totalShipmentsCompleted 
        : 0;
      const fuelEfficiency = totalFuelConsumed > 0 
        ? totalDistance / totalFuelConsumed 
        : 0;

      // Create and return the weekly summary
      return {
        employeeId,
        weekStart,
        weekEnd,
        dailySummaries: weekDailySummaries,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
        fuelEfficiency: Math.round(fuelEfficiency * 100) / 100,
        totalShipmentsCompleted,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        workingDays
      } as WeeklyRouteSummary;
    });
  }

  /**
   * Analyze monthly route data
   */
  analyzeMonthlyRoutes(weeklySummaries: WeeklyRouteSummary[]): MonthlyRouteSummary[] {
    // Group weekly summaries by month and employee
    const monthGroups = weeklySummaries.reduce<Record<string, {
      month: string;
      employeeId: string;
      summaries: WeeklyRouteSummary[];
    }>>((groups, week) => {
      const month = week.weekStart.substring(0, 7); // YYYY-MM
      const key = `${month}_${week.employeeId}`;

      if (!groups[key]) {
        groups[key] = {
          month,
          employeeId: week.employeeId,
          summaries: []
        };
      }
      groups[key].summaries.push(week);
      return groups;
    }, {});

    // Process each month group
    return Object.values(monthGroups).map(({ month, employeeId, summaries: monthWeeklySummaries }) => {
      // Calculate monthly totals
      const totalDistance = monthWeeklySummaries.reduce((sum, week) => sum + (week.totalDistance ?? 0), 0);
      const totalTime = monthWeeklySummaries.reduce((sum, week) => sum + (week.totalTime ?? 0), 0);
      const totalFuelConsumed = monthWeeklySummaries.reduce((sum, week) => sum + (week.totalFuelConsumed ?? 0), 0);
      const totalFuelCost = monthWeeklySummaries.reduce((sum, week) => sum + (week.totalFuelCost ?? 0), 0);
      const totalShipmentsCompleted = monthWeeklySummaries.reduce((sum, week) => sum + (week.totalShipmentsCompleted ?? 0), 0);
      
      // Calculate working days (days with at least one session)
      const workingDays = monthWeeklySummaries.reduce(
        (sum, week) => sum + (week.dailySummaries?.length ?? 0), 
        0
      );
      
      // Calculate metrics
      const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
      const efficiency = totalShipmentsCompleted > 0 ? totalDistance / totalShipmentsCompleted : 0;
      const fuelEfficiency = totalDistance > 0 ? (totalDistance / totalFuelConsumed) || 0 : 0;

      return {
        employeeId,
        month,
        weeklySummaries: monthWeeklySummaries,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
        fuelEfficiency: Math.round(fuelEfficiency * 100) / 100,
        totalShipmentsCompleted,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        workingDays
      };
    });
  }

  /**
   * Compare performance between employees
   */
  compareEmployeePerformance(
    summaries: DailyRouteSummary[]
  ): {
    employeeId: string;
    metrics: {
      efficiency: number;
      averageSpeed: number;
      fuelConsumption: number; // per 100km
      shipmentsPerDay: number;
    };
    ranking: {
      efficiency: number; // 1 = best
      speed: number;
      fuel: number;
      productivity: number;
    };
  }[] {
    const employeeMetrics = summaries.map(summary => {
      const fuelPer100km = summary.totalDistance > 0 ? ((summary.totalFuelConsumed ?? 0) / summary.totalDistance) * 100 : 0;

      return {
        employeeId: summary.employeeId,
        metrics: {
          efficiency: summary.efficiency,
          averageSpeed: summary.averageSpeed ?? 0,
          fuelConsumption: fuelPer100km,
          shipmentsPerDay: summary.shipmentsCompleted ?? 0
        }
      };
    });

    // Calculate rankings
    const withRankings = employeeMetrics.map(emp => {
      const efficiencyRank = employeeMetrics.filter(other => other.metrics.efficiency < emp.metrics.efficiency).length + 1;
      const speedRank = employeeMetrics.filter(other => other.metrics.averageSpeed > emp.metrics.averageSpeed).length + 1;
      const fuelRank = employeeMetrics.filter(other => other.metrics.fuelConsumption < emp.metrics.fuelConsumption).length + 1;
      const productivityRank = employeeMetrics.filter(other => other.metrics.shipmentsPerDay > emp.metrics.shipmentsPerDay).length + 1;

      return {
        ...emp,
        ranking: {
          efficiency: efficiencyRank,
          speed: speedRank,
          fuel: fuelRank,
          productivity: productivityRank
        }
      };
    });

    return withRankings.sort((a, b) => {
      // Sort by overall performance (lower total rank is better)
      const aTotal = a.ranking.efficiency + a.ranking.speed + a.ranking.fuel + a.ranking.productivity;
      const bTotal = b.ranking.efficiency + b.ranking.speed + b.ranking.fuel + b.ranking.productivity;
      return aTotal - bTotal;
    });
  }
}
