import { RouteTracking } from '@shared/schema';
import { DistanceCalculator } from './DistanceCalculator';

export interface AggregationFilters {
  employeeIds?: string[];
  startDate?: string;
  endDate?: string;
  routeNames?: string[];
  vehicleTypes?: string[];
}

export interface EmployeePerformanceMetrics {
  employeeId: string;
  totalDistance: number;
  totalTime: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalShipmentsCompleted: number;
  averageSpeed: number;
  efficiency: number; // km per shipment
  workingDays: number;
  averageDistancePerDay: number;
  averageShipmentsPerDay: number;
  fuelEfficiencyRating: 'excellent' | 'good' | 'average' | 'poor';
  performanceScore: number; // 0-100
}

export interface RoutePerformanceMetrics {
  routeName: string;
  totalDistance: number;
  totalTime: number;
  totalShipments: number;
  averageSpeed: number;
  efficiency: number;
  fuelConsumed: number;
  fuelCost: number;
  employeeCount: number;
  averageDistancePerShipment: number;
  popularityScore: number; // based on usage frequency
}

export interface TimeBasedMetrics {
  period: string; // date or time range
  totalDistance: number;
  totalTime: number;
  totalShipments: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageSpeed: number;
  efficiency: number;
  activeEmployees: number;
  peakHours: Array<{
    hour: number;
    activity: number;
  }>;
}

export interface FuelAnalyticsData {
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageFuelEfficiency: number; // km per liter
  costPerKm: number;
  fuelPerKm: number;
  byVehicleType: Record<string, {
    fuelConsumed: number;
    fuelCost: number;
    efficiency: number;
    distance: number;
  }>;
  byEmployee: Record<string, {
    fuelConsumed: number;
    fuelCost: number;
    efficiency: number;
    distance: number;
  }>;
  trends: Array<{
    period: string;
    consumption: number;
    cost: number;
    efficiency: number;
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

export class RouteDataAggregator {
  /**
   * Aggregate employee performance metrics
   */
  static aggregateEmployeePerformance(
    routeData: RouteTracking[],
    filters: AggregationFilters = {}
  ): EmployeePerformanceMetrics[] {
    const filteredData = this.applyFilters(routeData, filters);
    const employeeGroups = this.groupByEmployee(filteredData);

    return Object.entries(employeeGroups).map(([employeeId, coordinates]) => {
      const dailyData = this.groupByDate(coordinates);
      const workingDays = Object.keys(dailyData).length;

      // Calculate totals
      const totalDistance = this.calculateTotalDistance(coordinates);
      const totalTime = this.calculateTotalTime(coordinates);
      const totalFuelConsumed = this.calculateTotalFuel(coordinates);
      const totalFuelCost = this.calculateTotalFuelCost(coordinates);
      const totalShipmentsCompleted = this.countCompletedShipments(coordinates);

      // Calculate averages
      const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
      const efficiency = totalShipmentsCompleted > 0 ? totalDistance / totalShipmentsCompleted : 0;
      const averageDistancePerDay = workingDays > 0 ? totalDistance / workingDays : 0;
      const averageShipmentsPerDay = workingDays > 0 ? totalShipmentsCompleted / workingDays : 0;

      // Calculate ratings and scores
      const fuelEfficiencyRating = this.calculateFuelEfficiencyRating(totalDistance, totalFuelConsumed);
      const performanceScore = this.calculatePerformanceScore({
        efficiency,
        averageSpeed,
        fuelEfficiency: totalDistance / (totalFuelConsumed || 1)
      });

      return {
        employeeId,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
        totalShipmentsCompleted,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        workingDays,
        averageDistancePerDay: Math.round(averageDistancePerDay * 100) / 100,
        averageShipmentsPerDay: Math.round(averageShipmentsPerDay * 100) / 100,
        fuelEfficiencyRating,
        performanceScore: Math.round(performanceScore)
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

    return Object.entries(routeGroups).map(([routeName, coordinates]) => {
      const totalDistance = this.calculateTotalDistance(coordinates);
      const totalTime = this.calculateTotalTime(coordinates);
      const totalShipments = this.countCompletedShipments(coordinates);
      const fuelConsumed = this.calculateTotalFuel(coordinates);
      const fuelCost = this.calculateTotalFuelCost(coordinates);

      const uniqueEmployees = new Set(coordinates.map(coord => coord.employeeId)).size;
      const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
      const efficiency = totalShipments > 0 ? totalDistance / totalShipments : 0;
      const averageDistancePerShipment = totalShipments > 0 ? totalDistance / totalShipments : 0;

      // Calculate popularity based on usage frequency
      const totalSessions = new Set(coordinates.map(coord => coord.sessionId)).size;
      const popularityScore = this.calculatePopularityScore(totalSessions, uniqueEmployees);

      return {
        routeName,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        totalShipments,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        fuelConsumed: Math.round(fuelConsumed * 100) / 100,
        fuelCost: Math.round(fuelCost * 100) / 100,
        employeeCount: uniqueEmployees,
        averageDistancePerShipment: Math.round(averageDistancePerShipment * 100) / 100,
        popularityScore: Math.round(popularityScore)
      };
    });
  }

  /**
   * Aggregate time-based metrics (daily, weekly, monthly)
   */
  static aggregateTimeBasedMetrics(
    routeData: RouteTracking[],
    groupBy: 'day' | 'week' | 'month',
    filters: AggregationFilters = {}
  ): TimeBasedMetrics[] {
    const filteredData = this.applyFilters(routeData, filters);
    const timeGroups = this.groupByTimePeriod(filteredData, groupBy);

    return Object.entries(timeGroups).map(([period, coordinates]) => {
      const totalDistance = this.calculateTotalDistance(coordinates);
      const totalTime = this.calculateTotalTime(coordinates);
      const totalShipments = this.countCompletedShipments(coordinates);
      const totalFuelConsumed = this.calculateTotalFuel(coordinates);
      const totalFuelCost = this.calculateTotalFuelCost(coordinates);

      const activeEmployees = new Set(coordinates.map(coord => coord.employeeId)).size;
      const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
      const efficiency = totalShipments > 0 ? totalDistance / totalShipments : 0;

      const peakHours = this.calculatePeakHours(coordinates);

      return {
        period,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalTime,
        totalShipments,
        totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        activeEmployees,
        peakHours
      };
    });
  }

  /**
   * Aggregate fuel analytics data
   */
  static aggregateFuelAnalytics(
    routeData: RouteTracking[],
    filters: AggregationFilters = {}
  ): FuelAnalyticsData {
    const filteredData = this.applyFilters(routeData, filters);

    const totalDistance = this.calculateTotalDistance(filteredData);
    const totalFuelConsumed = this.calculateTotalFuel(filteredData);
    const totalFuelCost = this.calculateTotalFuelCost(filteredData);

    const averageFuelEfficiency = totalFuelConsumed > 0 ? totalDistance / totalFuelConsumed : 0;
    const costPerKm = totalDistance > 0 ? totalFuelCost / totalDistance : 0;
    const fuelPerKm = totalDistance > 0 ? totalFuelConsumed / totalDistance : 0;

    // Group by vehicle type
    const vehicleGroups = this.groupByVehicleType(filteredData);
    const byVehicleType: Record<string, any> = {};

    Object.entries(vehicleGroups).forEach(([vehicleType, coordinates]) => {
      const distance = this.calculateTotalDistance(coordinates);
      const fuel = this.calculateTotalFuel(coordinates);
      const cost = this.calculateTotalFuelCost(coordinates);

      byVehicleType[vehicleType] = {
        fuelConsumed: Math.round(fuel * 100) / 100,
        fuelCost: Math.round(cost * 100) / 100,
        efficiency: fuel > 0 ? Math.round((distance / fuel) * 100) / 100 : 0,
        distance: Math.round(distance * 100) / 100
      };
    });

    // Group by employee
    const employeeGroups = this.groupByEmployee(filteredData);
    const byEmployee: Record<string, any> = {};

    Object.entries(employeeGroups).forEach(([employeeId, coordinates]) => {
      const distance = this.calculateTotalDistance(coordinates);
      const fuel = this.calculateTotalFuel(coordinates);
      const cost = this.calculateTotalFuelCost(coordinates);

      byEmployee[employeeId] = {
        fuelConsumed: Math.round(fuel * 100) / 100,
        fuelCost: Math.round(cost * 100) / 100,
        efficiency: fuel > 0 ? Math.round((distance / fuel) * 100) / 100 : 0,
        distance: Math.round(distance * 100) / 100
      };
    });

    // Calculate trends
    const monthlyGroups = this.groupByTimePeriod(filteredData, 'month');
    const trends = Object.entries(monthlyGroups).map(([period, coordinates]) => {
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
      totalFuelConsumed: Math.round(totalFuelConsumed * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      averageFuelEfficiency: Math.round(averageFuelEfficiency * 100) / 100,
      costPerKm: Math.round(costPerKm * 1000) / 1000, // 3 decimal places for cost
      fuelPerKm: Math.round(fuelPerKm * 1000) / 1000,
      byVehicleType,
      byEmployee,
      trends
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
      distance: calculateChange(currentMetrics.totalDistance, previousMetrics.totalDistance),
      time: calculateChange(currentMetrics.totalTime, previousMetrics.totalTime),
      fuel: calculateChange(currentMetrics.totalFuelConsumed, previousMetrics.totalFuelConsumed),
      cost: calculateChange(currentMetrics.totalFuelCost, previousMetrics.totalFuelCost),
      efficiency: calculateChange(currentMetrics.efficiency, previousMetrics.efficiency),
      speed: calculateChange(currentMetrics.averageSpeed, previousMetrics.averageSpeed)
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
      if (filters.employeeIds && !filters.employeeIds.includes(coord.employeeId)) {
        return false;
      }
      if (filters.startDate && coord.date < filters.startDate) {
        return false;
      }
      if (filters.endDate && coord.date > filters.endDate) {
        return false;
      }
      if (filters.vehicleTypes && !filters.vehicleTypes.includes(coord.vehicleType || 'standard')) {
        return false;
      }
      return true;
    });
  }

  private static groupByEmployee(data: RouteTracking[]): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      if (!groups[coord.employeeId]) {
        groups[coord.employeeId] = [];
      }
      groups[coord.employeeId].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static groupByRoute(data: RouteTracking[]): Record<string, RouteTracking[]> {
    // For now, we'll use a placeholder route name since it's not in the current schema
    // In a real implementation, this would come from shipment data or route context
    return data.reduce((groups, coord) => {
      const routeName = `Route-${coord.employeeId}`; // Placeholder
      if (!groups[routeName]) {
        groups[routeName] = [];
      }
      groups[routeName].push(coord);
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
    groupBy: 'day' | 'week' | 'month'
  ): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      let period: string;

      switch (groupBy) {
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
      const vehicleType = coord.vehicleType || 'standard';
      if (!groups[vehicleType]) {
        groups[vehicleType] = [];
      }
      groups[vehicleType].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static calculateTotalDistance(data: RouteTracking[]): number {
    // Group by session and calculate distance for each session
    const sessions = this.groupBySession(data);
    let totalDistance = 0;

    Object.values(sessions).forEach(sessionCoords => {
      if (sessionCoords.length >= 2) {
        const sessionDistance = DistanceCalculator.calculateRouteMetrics(sessionCoords).totalDistance;
        totalDistance += sessionDistance;
      }
    });

    return totalDistance;
  }

  private static calculateTotalTime(data: RouteTracking[]): number {
    const sessions = this.groupBySession(data);
    let totalTime = 0;

    Object.values(sessions).forEach(sessionCoords => {
      if (sessionCoords.length >= 2) {
        const startTime = new Date(sessionCoords[0].timestamp);
        const endTime = new Date(sessionCoords[sessionCoords.length - 1].timestamp);
        totalTime += (endTime.getTime() - startTime.getTime()) / 1000; // seconds
      }
    });

    return totalTime;
  }

  private static calculateTotalFuel(data: RouteTracking[]): number {
    return data.reduce((total, coord) => total + (coord.fuelConsumed || 0), 0);
  }

  private static calculateTotalFuelCost(data: RouteTracking[]): number {
    return data.reduce((total, coord) => total + (coord.fuelCost || 0), 0);
  }

  private static countCompletedShipments(data: RouteTracking[]): number {
    const shipmentIds = new Set(
      data
        .filter(coord => coord.shipmentId && coord.eventType)
        .map(coord => coord.shipmentId)
    );
    return shipmentIds.size;
  }

  private static groupBySession(data: RouteTracking[]): Record<string, RouteTracking[]> {
    return data.reduce((groups, coord) => {
      if (!groups[coord.sessionId]) {
        groups[coord.sessionId] = [];
      }
      groups[coord.sessionId].push(coord);
      return groups;
    }, {} as Record<string, RouteTracking[]>);
  }

  private static calculatePeakHours(data: RouteTracking[]): Array<{ hour: number; activity: number }> {
    const hourlyActivity = new Array(24).fill(0);

    data.forEach(coord => {
      const hour = new Date(coord.timestamp).getHours();
      hourlyActivity[hour]++;
    });

    return hourlyActivity.map((activity, hour) => ({ hour, activity }));
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
    averageSpeed: number;
    fuelEfficiency: number;
  }): number {
    // Normalize metrics to 0-100 scale and weight them
    const efficiencyScore = Math.min(100, (metrics.efficiency / 10) * 100); // Assume 10 km/shipment is perfect
    const speedScore = Math.min(100, (metrics.averageSpeed / 30) * 100); // Assume 30 km/h is perfect
    const fuelScore = Math.min(100, (metrics.fuelEfficiency / 20) * 100); // Assume 20 km/L is perfect

    // Weighted average: efficiency 40%, speed 30%, fuel 30%
    return (efficiencyScore * 0.4) + (speedScore * 0.3) + (fuelScore * 0.3);
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
      totalDistance: 0,
      totalTime: 0,
      totalShipments: 0,
      totalFuelConsumed: 0,
      totalFuelCost: 0,
      averageSpeed: 0,
      efficiency: 0,
      activeEmployees: 0,
      peakHours: []
    };
  }
}