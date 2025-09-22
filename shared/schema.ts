// Shared schema types for client-server communication

// Core entities
export interface Shipment {
  id: string;
  trackingNumber: string;
  status: string;
  priority: string;
  type?: string;
  pickupAddress: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  weight: number;
  dimensions: string;
  specialInstructions?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  createdAt: string;
  updatedAt: string;
  // Additional properties used by components
  customerName?: string;
  customerMobile?: string;
  address?: string;
  cost?: number;
  deliveryTime?: string;
  routeName?: string;
  employeeId?: string;
}

export interface InsertShipment {
  trackingNumber: string;
  status: string;
  priority: string;
  type?: string;
  pickupAddress: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  weight: number;
  dimensions: string;
  specialInstructions?: string;
  estimatedDeliveryTime?: string;
  // Additional properties used by database queries
  customerName?: string;
  customerMobile?: string;
  address?: string;
  cost?: number;
  deliveryTime?: string;
  routeName?: string;
  employeeId?: string;
}

export interface UpdateShipment {
  id: string;
  status?: string;
  priority?: string;
  type?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  weight?: number;
  dimensions?: string;
  specialInstructions?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  // Additional properties for database compatibility
  customerName?: string;
  customerMobile?: string;
  address?: string;
  cost?: number;
  deliveryTime?: string;
  routeName?: string;
  employeeId?: string;
}

export interface BatchUpdate {
  updates: UpdateShipment[];
}

export interface Acknowledgment {
  id: string;
  shipmentId: string;
  recipientName: string;
  signature?: string;
  photo?: string;
  timestamp: string;
  location?: string;
  notes?: string;
}

export interface InsertAcknowledgment {
  shipmentId: string;
  recipientName: string;
  signature?: string;
  photo?: string;
  timestamp: string;
  location?: string;
  notes?: string;
}

export interface DashboardMetrics {
  totalShipments: number;
  pendingShipments?: number;
  deliveredShipments?: number;
  inTransitShipments?: number;
  completed: number;
  inProgress: number;
  pending: number;
  averageDeliveryTime?: number;
  onTimeDeliveryRate?: number;
  statusBreakdown?: Record<string, number>;
  typeBreakdown?: Record<string, number>;
  routeBreakdown?: Record<string, any>;
}

export interface ShipmentFilters {
  // Filtering
  status?: string;
  priority?: string;
  type?: string;
  routeName?: string;
  date?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
  employeeId?: string;
  
  // Pagination
  page?: number | string;
  limit?: number | string;
  
  // Sorting
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Route schemas
export interface startRouteSessionSchema {
  routeId: string;
  driverId: string;
  vehicleId: string;
}

export interface stopRouteSessionSchema {
  sessionId: string;
  endLocation: {
    latitude: number;
    longitude: number;
  };
}

// Aliases for API compatibility
export interface StartRouteSession {
  employeeId: string;
  latitude: number;
  longitude: number;
  routeId?: string;
  driverId?: string;
  vehicleId?: string;
}

export interface StopRouteSession {
  sessionId: string;
  latitude: number;
  longitude: number;
  endLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface gpsCoordinateSchema {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface routeFiltersSchema {
  dateRange?: {
    start: string;
    end: string;
  };
  driverId?: string;
  status?: string;
}

// Additional route tracking types
export interface RouteTracking {
  id: string;
  sessionId: string;
  employeeId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  eventType?: string;
  shipmentId?: string;
  date: string;
  vehicleType?: string;
  fuelConsumed?: number;
  fuelCost?: number;
  totalDistance?: number;
  totalTime?: number;
  averageSpeed?: number;
  shipmentsCompleted?: number;
  fuelEfficiency?: number;
  fuelPrice?: number;
}

export interface InsertRouteTracking {
  sessionId: string;
  employeeId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  eventType?: string;
  shipmentId?: string;
  date: string;
  vehicleType?: string;
  fuelConsumed?: number;
  fuelCost?: number;
  totalDistance?: number;
  totalTime?: number;
  averageSpeed?: number;
  shipmentsCompleted?: number;
  fuelEfficiency?: number;
  fuelPrice?: number;
}

export interface RouteSession {
  id: string;
  employeeId: string;
  startTime: string;
  endTime?: string;
  status: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  totalDistance?: number;
  totalTime?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GPSCoordinate {
  id?: string;
  sessionId?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface RouteFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  employeeId?: string;
  status?: string;
  sessionStatus?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}

// Schema validation types (for routes.ts)
// These are placeholder schemas - in a real app you'd use Zod or similar for validation
export const insertShipmentSchema = {
  validate: (data: any): data is InsertShipment => true
} as any;

export const updateShipmentSchema = {
  validate: (data: any): data is UpdateShipment => true
} as any;

export const batchUpdateSchema = {
  validate: (data: any): data is BatchUpdate => true
} as any;

export const insertAcknowledgmentSchema = {
  validate: (data: any): data is InsertAcknowledgment => true
} as any;

export const shipmentFiltersSchema = {
  validate: (data: any): data is ShipmentFilters => true
} as any;

export const startRouteSessionSchemaValidator = {
  validate: (data: any): data is startRouteSessionSchema => true
} as any;

export const stopRouteSessionSchemaValidator = {
  validate: (data: any): data is stopRouteSessionSchema => true
} as any;

export const gpsCoordinateSchemaValidator = {
  validate: (data: any): data is gpsCoordinateSchema => true
} as any;

export const routeFiltersSchemaValidator = {
  validate: (data: any): data is routeFiltersSchema => true
} as any;

export interface RouteAnalytics {
  routeId: string;
  employeeId: string;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  fuelConsumption: number;
  fuelConsumed: number; // alias for fuelConsumption
  fuelCost: number;
  stops: number;
  efficiency: number;
  shipmentsCompleted: number;
  date: string;
}

export interface EmployeePerformance {
  employeeId: string;
  name: string;
  totalRoutes: number;
  totalDistance: number;
  averageEfficiency: number;
  onTimeDeliveries: number;
  totalDeliveries: number;
  fuelEfficiency: number;
  rating: number;
}

export interface FuelAnalytics {
  date: string;
  consumption: number;
  cost: number;
  efficiency: number;
  distance: number;
}

export interface PerformanceMetrics {
  date: string;
  averageSpeed: number;
  efficiency: number;
  deliveryTime: number;
  customerSatisfaction: number;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  dateRange: {
    start: string;
    end: string;
  };
  includeRoutes: boolean;
  includeAnalytics: boolean;
  includePerformance: boolean;
}

export interface ExportProgress {
  stage: string;
  progress: number;
  total: number;
  message: string;
}
// Additional analytics types
export interface RouteMetrics {
  routeId: string;
  employeeId: string;
  distance: number;
  duration: number;
  fuelUsed: number;
  averageSpeed: number;
  stops: number;
  efficiency: number;
  date: string;
}

export interface AnalyticsFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  employeeId?: string;
  routeId?: string;
  metricType?: 'fuel' | 'performance' | 'efficiency';
}

export interface DashboardStats {
  totalRoutes: number;
  totalDistance: number;
  totalFuelConsumed: number;
  averageEfficiency: number;
  activeEmployees: number;
  completedShipments: number;
}