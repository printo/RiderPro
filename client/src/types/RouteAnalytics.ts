// Route Analytics Types
export interface RouteAnalytics {
  routeId: string;
  employeeId: string;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  fuelConsumption: number;
  fuelConsumed: number;
  fuelCost: number;
  stops: number;
  efficiency: number;
  date: string;
  shipmentsCompleted: number;
}

export interface DailyRouteSummary {
  employeeId: string;
  date: string;
  totalSessions: number;
  totalDistance: number;
  totalTime: number;
  fuelConsumed: number;
  fuelCost: number;
  shipmentsCompleted: number;
  efficiency: number;
}

export interface RouteMetrics {
  sessionId: string;
  employeeId: string;
  date: string;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  fuelConsumed: number;
  fuelCost: number;
  shipmentsCompleted: number;
}

export interface FuelAnalytics {
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageEfficiency: number;
  costPerKm: number;
  dailyBreakdown: Array<{
    date: string;
    fuelConsumed: number;
    fuelCost: number;
    distance: number;
  }>;
}

export interface PerformanceMetrics {
  averageSpeed: number;
  totalDistance: number;
  totalTime: number;
  efficiency: number;
  completionRate: number;
  onTimeDeliveries: number;
}