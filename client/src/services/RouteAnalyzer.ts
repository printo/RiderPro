import { RouteTracking, RouteAnalytics } from '@shared/schema';
import { DistanceCalculator, DistanceCalculationResult } from './DistanceCalculator';

export interface DailyRouteSummary {
  employeeId: string;
  date: string; // YYYY-MM-DD
  totalSessions: number;
  totalDistance: number; // km
  totalTime: number; // seconds
  totalFuelConsumed: number; // liters
  totalFuelCost: number; // currency
  shipmentsCompleted: number;
  averageSpeed: number; // km/h
  efficiency: number; // km per shipment
  stationaryTime: number; // seconds
  movingTime: number; // seconds
  maxSpeed: number; // km/h
  sessions: RouteSessionSummary[];
}

export interface RouteSessionSummary {
  sessionId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  distance: number; // km
  duration: number; // seconds
  averageSpeed: number; // km/h
  maxSpeed: number; // km/h
  fuelConsumed: number; // liters
  fuelCost: number; // currency
  shipmentsCompleted: number;
  coordinateCount: number;
  efficiency: number; // km per shipment
}

export interface WeeklyRouteSummary {
  employeeId: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  dailySummaries: DailyRouteSummary[];
  totalDistance: number;
  totalTime: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalShipmentsCompleted: number;
  averageSpeed: number;
  efficiency: number;
}

export interface MonthlyRouteSummary {
  employeeId: string;
  month: string; // YYYY-MM
  weeklySummaries: WeeklyRouteSummary[];
  totalDistance: number;
  totalTime: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalShipmentsCompleted: number;
  averageSpeed: number;
  efficiency: number;
  workingDays: number;
}

export interface FuelSettings {
  vehicleType: string;
  fuelEfficiency: number; // km per liter
  fuelPrice: number; // price per liter
}

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
  private defaultFuelSettings: FuelSettings = {
    vehicleType: 'standard',
    fuelEfficiency: 15.0, // km per liter
    fuelPrice: 1.5 // price per liter
  };

  constructor(private fuelSettings: FuelSettings = {
    vehicleType: 'standard',
    fuelEfficiency: 15.0,
    fuelPrice: 1.5
  }) { }

  /**
   * Analyze route data for a single session
   */
  analyzeRouteSession(
    coordinates: RouteTracking[],
    fuelSettings?: FuelSettings
  ): RouteSessionSummary {
    if (coordinates.length === 0) {
      throw new Error('No coordinates provided for analysis');
    }

    const sessionId = coordinates[0].sessionId;
    const employeeId = coordinates[0].employeeId;

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
        .map(coord => coord.shipmentId)
    ).size;

    // Calculate fuel consumption
    const fuel = DistanceCalculator.calculateFuelConsumption(
      metrics.totalDistance,
      fuelSettings?.fuelEfficiency || this.fuelSettings.fuelEfficiency,
      fuelSettings?.fuelPrice || this.fuelSettings.fuelPrice
    );

    const startTime = sessionCoords[0].timestamp;
    const endTime = sessionCoords[sessionCoords.length - 1].timestamp;
    const efficiency = shipmentsCompleted > 0 ? metrics.totalDistance / shipmentsCompleted : 0;

    return {
      sessionId,
      employeeId,
      startTime,
      endTime,
      distance: metrics.totalDistance,
      duration: metrics.totalTime,
      averageSpeed: metrics.averageSpeed,
      maxSpeed: metrics.maxSpeed,
      fuelConsumed: fuel.liters,
      fuelCost: fuel.cost || 0,
      shipmentsCompleted,
      coordinateCount: sessionCoords.length,
      efficiency: Math.round(efficiency * 100) / 100
    };
  }

  /**
   * Analyze daily route data for an employee
   */
  analyzeDailyRoutes(
    coordinates: RouteTracking[],
    employeeId: string,
    date: string,
    fuelSettings?: FuelSettings
  ): DailyRouteSummary {
    // Filter coordinates for the specific employee and date
    const dayCoords = coordinates.filter(coord =>
      coord.employeeId === employeeId &&
      coord.date === date
    );

    if (dayCoords.length === 0) {
      return this.createEmptyDailySummary(employeeId, date);
    }

    // Group coordinates by session
    const sessionGroups = this.groupCoordinatesBySession(dayCoords);
    const sessions: RouteSessionSummary[] = [];

    let totalDistance = 0;
    let totalTime = 0;
    let totalFuelConsumed = 0;
    let totalFuelCost = 0;
    let totalShipmentsCompleted = 0;
    let totalCoordinates = 0;
    let maxSpeed = 0;

    // Analyze each session
    for (const sessionCoords of sessionGroups) {
      if (sessionCoords.length >= 2) {
        const sessionSummary = this.analyzeRouteSession(sessionCoords, fuelSettings);
        sessions.push(sessionSummary);

        totalDistance += sessionSummary.distance;
        totalTime += sessionSummary.duration;
        totalFuelConsumed += sessionSummary.fuelConsumed;
        totalFuelCost += sessionSummary.fuelCost;
        totalShipmentsCompleted += sessionSummary.shipmentsCompleted;
        totalCoordinates += sessionSummary.coordinateCount;
        maxSpeed = Math.max(maxSpeed, sessionSummary.maxSpeed);
      }
    }

    // Calculate stationary time
    const stationaryPeriods = DistanceCalculator.findStationaryPeriods(dayCoords);
    const stationaryTime = stationaryPeriods.reduce((sum, period) => sum + (period.duration * 60), 0); // convert to seconds
    const movingTime = Math.max(0, totalTime - stationaryTime);

    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
    const efficiency = totalShipmentsCompleted > 0 ? totalDistance / totalShipmentsCompleted : 0;

    return {
      employeeId,
      date,
      totalSessions: sessions.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime,
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      shipmentsCompleted: totalShipmentsCompleted,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
      stationaryTime,
      movingTime,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      sessions
    };
  }

  /**
   * Analyze weekly route data
   */
  analyzeWeeklyRoutes(
    coordinates: RouteTracking[],
    employeeId: string,
    weekStart: string,
    fuelSettings?: FuelSettings
  ): WeeklyRouteSummary {
    const weekEnd = this.addDays(weekStart, 6);
    const dailySummaries: DailyRouteSummary[] = [];

    // Generate daily summaries for the week
    for (let i = 0; i < 7; i++) {
      const date = this.addDays(weekStart, i);
      const dailySummary = this.analyzeDailyRoutes(coordinates, employeeId, date, fuelSettings);
      if (dailySummary.totalSessions > 0) {
        dailySummaries.push(dailySummary);
      }
    }

    // Aggregate weekly totals
    const totalDistance = dailySummaries.reduce((sum, day) => sum + day.totalDistance, 0);
    const totalTime = dailySummaries.reduce((sum, day) => sum + day.totalTime, 0);
    const totalFuelConsumed = dailySummaries.reduce((sum, day) => sum + day.totalFuelConsumed, 0);
    const totalFuelCost = dailySummaries.reduce((sum, day) => sum + day.totalFuelCost, 0);
    const totalShipmentsCompleted = dailySummaries.reduce((sum, day) => sum + day.shipmentsCompleted, 0);

    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
    const efficiency = totalShipmentsCompleted > 0 ? totalDistance / totalShipmentsCompleted : 0;

    return {
      employeeId,
      weekStart,
      weekEnd,
      dailySummaries,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime,
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      totalShipmentsCompleted,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100
    };
  }

  /**
   * Analyze monthly route data
   */
  analyzeMonthlyRoutes(
    coordinates: RouteTracking[],
    employeeId: string,
    month: string, // YYYY-MM
    fuelSettings?: FuelSettings
  ): MonthlyRouteSummary {
    const weeklySummaries: WeeklyRouteSummary[] = [];
    const monthStart = `${month}-01`;
    const monthEnd = this.getLastDayOfMonth(month);

    // Generate weekly summaries for the month
    let currentWeekStart = this.getFirstMondayOfMonth(monthStart);
    while (currentWeekStart <= monthEnd) {
      const weeklySummary = this.analyzeWeeklyRoutes(coordinates, employeeId, currentWeekStart, fuelSettings);
      if (weeklySummary.dailySummaries.length > 0) {
        weeklySummaries.push(weeklySummary);
      }
      currentWeekStart = this.addDays(currentWeekStart, 7);
    }

    // Aggregate monthly totals
    const totalDistance = weeklySummaries.reduce((sum, week) => sum + week.totalDistance, 0);
    const totalTime = weeklySummaries.reduce((sum, week) => sum + week.totalTime, 0);
    const totalFuelConsumed = weeklySummaries.reduce((sum, week) => sum + week.totalFuelConsumed, 0);
    const totalFuelCost = weeklySummaries.reduce((sum, week) => sum + week.totalFuelCost, 0);
    const totalShipmentsCompleted = weeklySummaries.reduce((sum, week) => sum + week.totalShipmentsCompleted, 0);

    const workingDays = weeklySummaries.reduce((sum, week) => sum + week.dailySummaries.length, 0);
    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
    const efficiency = totalShipmentsCompleted > 0 ? totalDistance / totalShipmentsCompleted : 0;

    return {
      employeeId,
      month,
      weeklySummaries,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime,
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      totalShipmentsCompleted,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
      workingDays
    };
  }

  /**
   * Generate route optimization suggestions
   */
  generateOptimizationSuggestions(
    dailySummary: DailyRouteSummary,
    benchmarks?: {
      targetEfficiency?: number; // km per shipment
      maxFuelConsumption?: number; // liters per 100km
      targetSpeed?: number; // km/h
    }
  ): RouteOptimizationSuggestion[] {
    const suggestions: RouteOptimizationSuggestion[] = [];
    const defaultBenchmarks = {
      targetEfficiency: 5.0, // 5km per shipment
      maxFuelConsumption: 8.0, // 8L per 100km
      targetSpeed: 25.0 // 25 km/h average
    };

    const targets = { ...defaultBenchmarks, ...benchmarks };

    // Efficiency analysis
    if (dailySummary.efficiency > targets.targetEfficiency) {
      const excessDistance = (dailySummary.efficiency - targets.targetEfficiency) * dailySummary.shipmentsCompleted;
      const fuelSaving = DistanceCalculator.calculateFuelConsumption(
        excessDistance,
        this.fuelSettings.fuelEfficiency,
        this.fuelSettings.fuelPrice
      );

      suggestions.push({
        type: 'efficiency',
        severity: excessDistance > 20 ? 'high' : excessDistance > 10 ? 'medium' : 'low',
        title: 'Route Efficiency Improvement',
        description: `Current efficiency is ${dailySummary.efficiency.toFixed(1)} km per shipment, above target of ${targets.targetEfficiency} km.`,
        potentialSaving: {
          distance: Math.round(excessDistance * 100) / 100,
          fuel: fuelSaving.liters,
          cost: fuelSaving.cost
        },
        recommendation: 'Consider optimizing route planning to reduce distance per shipment. Group nearby deliveries and minimize backtracking.'
      });
    }

    // Fuel consumption analysis
    const fuelPer100km = dailySummary.totalDistance > 0 ? (dailySummary.totalFuelConsumed / dailySummary.totalDistance) * 100 : 0;
    if (fuelPer100km > targets.maxFuelConsumption) {
      const excessFuel = ((fuelPer100km - targets.maxFuelConsumption) / 100) * dailySummary.totalDistance;
      const costSaving = excessFuel * this.fuelSettings.fuelPrice;

      suggestions.push({
        type: 'fuel',
        severity: fuelPer100km > targets.maxFuelConsumption * 1.5 ? 'high' : fuelPer100km > targets.maxFuelConsumption * 1.2 ? 'medium' : 'low',
        title: 'High Fuel Consumption',
        description: `Fuel consumption is ${fuelPer100km.toFixed(1)}L per 100km, above target of ${targets.maxFuelConsumption}L per 100km.`,
        potentialSaving: {
          fuel: Math.round(excessFuel * 100) / 100,
          cost: Math.round(costSaving * 100) / 100
        },
        recommendation: 'Review driving patterns, reduce idling time, and consider vehicle maintenance to improve fuel efficiency.'
      });
    }

    // Speed analysis
    if (dailySummary.averageSpeed < targets.targetSpeed * 0.8) {
      const timeSaving = (dailySummary.totalDistance / targets.targetSpeed - dailySummary.totalDistance / dailySummary.averageSpeed) * 60; // minutes

      suggestions.push({
        type: 'time',
        severity: dailySummary.averageSpeed < targets.targetSpeed * 0.6 ? 'high' : 'medium',
        title: 'Low Average Speed',
        description: `Average speed is ${dailySummary.averageSpeed.toFixed(1)} km/h, below optimal range.`,
        potentialSaving: {
          time: Math.round(timeSaving)
        },
        recommendation: 'Analyze route for traffic bottlenecks, optimize departure times, and consider alternative routes during peak hours.'
      });
    }

    // Stationary time analysis
    const stationaryPercentage = dailySummary.totalTime > 0 ? (dailySummary.stationaryTime / dailySummary.totalTime) * 100 : 0;
    if (stationaryPercentage > 30) {
      suggestions.push({
        type: 'time',
        severity: stationaryPercentage > 50 ? 'high' : 'medium',
        title: 'Excessive Stationary Time',
        description: `${stationaryPercentage.toFixed(1)}% of time spent stationary, which may indicate inefficient routing or long stops.`,
        potentialSaving: {
          time: Math.round((dailySummary.stationaryTime - dailySummary.totalTime * 0.2) / 60) // Assume 20% is acceptable
        },
        recommendation: 'Review stop durations, minimize unnecessary breaks, and optimize pickup/delivery sequences.'
      });
    }

    return suggestions;
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
      const fuelPer100km = summary.totalDistance > 0 ? (summary.totalFuelConsumed / summary.totalDistance) * 100 : 0;

      return {
        employeeId: summary.employeeId,
        metrics: {
          efficiency: summary.efficiency,
          averageSpeed: summary.averageSpeed,
          fuelConsumption: fuelPer100km,
          shipmentsPerDay: summary.shipmentsCompleted
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

  // Helper methods

  private groupCoordinatesBySession(coordinates: RouteTracking[]): RouteTracking[][] {
    const sessionMap = new Map<string, RouteTracking[]>();

    coordinates.forEach(coord => {
      if (!sessionMap.has(coord.sessionId)) {
        sessionMap.set(coord.sessionId, []);
      }
      sessionMap.get(coord.sessionId)!.push(coord);
    });

    return Array.from(sessionMap.values()).map(coords =>
      coords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    );
  }

  private createEmptySessionSummary(sessionId: string, employeeId: string): RouteSessionSummary {
    return {
      sessionId,
      employeeId,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
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

  private createEmptyDailySummary(employeeId: string, date: string): DailyRouteSummary {
    return {
      employeeId,
      date,
      totalSessions: 0,
      totalDistance: 0,
      totalTime: 0,
      totalFuelConsumed: 0,
      totalFuelCost: 0,
      shipmentsCompleted: 0,
      averageSpeed: 0,
      efficiency: 0,
      stationaryTime: 0,
      movingTime: 0,
      maxSpeed: 0,
      sessions: []
    };
  }

  private addDays(dateString: string, days: number): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private getLastDayOfMonth(month: string): string {
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    return `${month}-${lastDay.toString().padStart(2, '0')}`;
  }

  private getFirstMondayOfMonth(dateString: string): string {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // 0 = Sunday
    date.setDate(date.getDate() + daysToMonday);
    return date.toISOString().split('T')[0];
  }
}