// Shared schema types for client-server communication

// External system integration interfaces
export interface ExternalShipmentPayload {
  id: string;                    // External tracking ID (maps to database id)
  status: string;
  priority: string;
  type: string;
  pickupAddress: string;
  deliveryAddress: string;       // Maps to address in database
  recipientName: string;         // Maps to customerName in database
  recipientPhone: string;        // Maps to customerMobile in database
  weight: number;
  dimensions: string;
  specialInstructions?: string;
  estimatedDeliveryTime: string; // Maps to deliveryTime in database
  customerName: string;          // Same as recipientName for compatibility
  customerMobile: string;        // Same as recipientPhone for compatibility
  address: string;               // Same as deliveryAddress
  latitude: number;
  longitude: number;
  cost: number;
  deliveryTime: string;          // Same as estimatedDeliveryTime
  routeName: string;
  employeeId: string;
}

export interface ExternalShipmentBatch {
  shipments: ExternalShipmentPayload[];
  metadata?: {
    source: string;
    batchId: string;
    timestamp: string;
  };
}

export interface ExternalUpdatePayload {
  piashipmentid: string;
  status: string;
  statusTimestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  employeeId: string;
  employeeName?: string;
  deliveryDetails?: {
    actualDeliveryTime?: string;
    recipientName?: string;
    deliveryNotes?: string;
    signature?: string;
    photo?: string;
  };
  routeInfo?: {
    routeName: string;
    sessionId?: string;
    totalDistance?: number;
    travelTime?: number;
  };
}

export interface ShipmentReceptionResponse {
  success: boolean;
  message: string;
  results: {
    total: number;
    created: number;
    updated: number;
    failed: number;
    duplicates: number;
  };
  processedShipments: Array<{
    piashipmentid: string;
    internalId: string;
    status: 'created' | 'updated' | 'failed';
    message: string;
  }>;
  timestamp: string;
}

export interface BatchSyncResult {
  success: boolean;
  message: string;
  results: {
    total: number;
    sent: number;
    failed: number;
  };
  processedUpdates: Array<{
    piashipmentid: string;
    status: 'sent' | 'failed';
    message: string;
  }>;
  timestamp: string;
}

// Core entities
export interface Shipment {
  // Primary key (now using shipment_id as primary)
  shipment_id: string;           // External shipment ID (now primary key)
  trackingNumber?: string;       // Legacy field for compatibility
  createdAt: string;
  updatedAt: string;

  // External integration fields
  piashipmentid?: string;        // External system tracking ID
  status: string;                // Assigned, In Transit, Delivered, etc.
  priority: string;              // high, medium, low
  type: string;                  // delivery, pickup

  // Address fields
  pickupAddress: string;
  deliveryAddress: string;
  address?: string;              // Alias for deliveryAddress

  // Contact fields
  recipientName: string;
  recipientPhone: string;
  customerName?: string;         // Alias for recipientName
  customerMobile?: string;       // Alias for recipientPhone

  // Package fields
  weight: number;
  dimensions: string;
  specialInstructions?: string;
  cost?: number;

  // Location fields
  latitude?: number;
  longitude?: number;

  // Timing fields
  estimatedDeliveryTime?: string;
  deliveryTime?: string;         // Alias for estimatedDeliveryTime
  expectedDeliveryTime?: string; // Renamed from actualDeliveryTime

  // Assignment fields
  routeName?: string;
  employeeId?: string;

  // Tracking fields
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled?: number;

  // Acknowledgment fields (merged from acknowledgments table)
  signatureUrl?: string;
  photoUrl?: string;
  capturedAt?: string;

  // Sync tracking fields (merged from sync_status table)
  synced_to_external?: boolean;
  last_sync_attempt?: string;
  sync_error?: string;
  sync_attempts?: number;
}

export interface InsertShipment {
  // Required fields
  shipment_id: string;           // External shipment ID (now required)
  trackingNumber?: string;       // Legacy field for compatibility
  status: string;
  priority: string;
  type: string;
  pickupAddress: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  weight: number;
  dimensions: string;

  // Optional fields
  piashipmentid?: string;        // External system tracking ID
  specialInstructions?: string;
  estimatedDeliveryTime?: string;
  expectedDeliveryTime?: string; // Renamed from actualDeliveryTime

  // Alias fields for compatibility
  customerName?: string;         // Alias for recipientName
  customerMobile?: string;       // Alias for recipientPhone
  address?: string;              // Alias for deliveryAddress
  deliveryTime?: string;         // Alias for estimatedDeliveryTime

  // Location and assignment fields
  latitude?: number;
  longitude?: number;
  cost?: number;
  routeName?: string;
  employeeId?: string;

  // Acknowledgment fields
  signatureUrl?: string;
  photoUrl?: string;
  capturedAt?: string;

  // Sync tracking fields
  synced_to_external?: boolean;
  last_sync_attempt?: string;
  sync_error?: string;
  sync_attempts?: number;
}

export interface UpdateShipment {
  shipment_id: string;

  // Core fields that can be updated
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

  // External integration fields
  piashipmentid?: string;

  // Alias fields for compatibility
  customerName?: string;         // Alias for recipientName
  customerMobile?: string;       // Alias for recipientPhone
  address?: string;              // Alias for deliveryAddress
  deliveryTime?: string;         // Alias for estimatedDeliveryTime

  // Location and assignment fields
  latitude?: number;
  longitude?: number;
  cost?: number;
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
  parse: (data: any): InsertShipment => {
    // Map address to deliveryAddress if needed
    if (data.address && !data.deliveryAddress) {
      data.deliveryAddress = data.address;
    }

    // Map customerName to recipientName if needed
    if (data.customerName && !data.recipientName) {
      data.recipientName = data.customerName;
    }

    // Map customerMobile to recipientPhone if needed
    if (data.customerMobile && !data.recipientPhone) {
      data.recipientPhone = data.customerMobile;
    }

    // Basic validation for required fields (trackingNumber is now optional for external shipments)
    const requiredFields = [
      'status', 'priority', 'type', 'pickupAddress',
      'deliveryAddress', 'recipientName', 'recipientPhone', 'weight', 'dimensions'
    ];

    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Type validation
    if (typeof data.weight !== 'number' || data.weight <= 0) {
      throw new Error('Weight must be a positive number');
    }

    if (data.trackingNumber && (typeof data.trackingNumber !== 'string' || data.trackingNumber.trim() === '')) {
      throw new Error('Tracking number must be a non-empty string');
    }

    // Validate latitude and longitude if provided
    if (data.latitude !== undefined && data.latitude !== null) {
      const lat = Number(data.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('Latitude must be a number between -90 and 90');
      }
      data.latitude = lat;
    }

    if (data.longitude !== undefined && data.longitude !== null) {
      const lng = Number(data.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new Error('Longitude must be a number between -180 and 180');
      }
      data.longitude = lng;
    }

    // Validate priority values
    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(data.priority.toLowerCase())) {
      throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate type values
    const validTypes = ['delivery', 'pickup'];
    if (!validTypes.includes(data.type.toLowerCase())) {
      throw new Error(`Type must be one of: ${validTypes.join(', ')}`);
    }

    // Return validated data
    return data as InsertShipment;
  },
  validate: (data: any): data is InsertShipment => {
    try {
      insertShipmentSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }
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

// External system integration validation schemas
export const externalShipmentPayloadSchema = {
  parse: (data: any): ExternalShipmentPayload => {
    // Required fields for external shipment payload
    const requiredFields = [
      'id', 'status', 'priority', 'type', 'pickupAddress', 'deliveryAddress',
      'recipientName', 'recipientPhone', 'weight', 'dimensions', 'estimatedDeliveryTime',
      'customerName', 'customerMobile', 'address', 'latitude', 'longitude',
      'cost', 'deliveryTime', 'routeName', 'employeeId'
    ];

    const missingFields = requiredFields.filter(field => !data[field] && data[field] !== 0);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Type validation
    if (typeof data.weight !== 'number' || data.weight <= 0) {
      throw new Error('Weight must be a positive number');
    }

    if (typeof data.cost !== 'number' || data.cost < 0) {
      throw new Error('Cost must be a non-negative number');
    }

    // Validate latitude and longitude
    const lat = Number(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error('Latitude must be a number between -90 and 90');
    }

    const lng = Number(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error('Longitude must be a number between -180 and 180');
    }

    // Validate priority values
    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(data.priority.toLowerCase())) {
      throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate type values
    const validTypes = ['delivery', 'pickup'];
    if (!validTypes.includes(data.type.toLowerCase())) {
      throw new Error(`Type must be one of: ${validTypes.join(', ')}`);
    }

    // Validate phone number format (basic validation for Indian numbers)
    const phoneRegex = /^[+]?[0-9]{10,15}$/;
    if (!phoneRegex.test(data.recipientPhone.replace(/\s+/g, ''))) {
      throw new Error('Recipient phone must be a valid phone number');
    }

    if (!phoneRegex.test(data.customerMobile.replace(/\s+/g, ''))) {
      throw new Error('Customer mobile must be a valid phone number');
    }

    return data as ExternalShipmentPayload;
  },
  validate: (data: any): data is ExternalShipmentPayload => {
    try {
      externalShipmentPayloadSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }
} as any;

export const externalShipmentBatchSchema = {
  parse: (data: any): ExternalShipmentBatch => {
    if (!data.shipments || !Array.isArray(data.shipments)) {
      throw new Error('Batch must contain a shipments array');
    }

    if (data.shipments.length === 0) {
      throw new Error('Batch cannot be empty');
    }

    if (data.shipments.length > 100) {
      throw new Error('Batch size cannot exceed 100 shipments');
    }

    // Validate each shipment in the batch
    data.shipments.forEach((shipment: any, index: number) => {
      try {
        externalShipmentPayloadSchema.parse(shipment);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        throw new Error(`Shipment at index ${index}: ${errorMessage}`);
      }
    });

    // Validate metadata if provided
    if (data.metadata) {
      if (!data.metadata.source || typeof data.metadata.source !== 'string') {
        throw new Error('Metadata source must be a non-empty string');
      }
      if (!data.metadata.batchId || typeof data.metadata.batchId !== 'string') {
        throw new Error('Metadata batchId must be a non-empty string');
      }
    }

    return data as ExternalShipmentBatch;
  },
  validate: (data: any): data is ExternalShipmentBatch => {
    try {
      externalShipmentBatchSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }
} as any;

export const externalUpdatePayloadSchema = {
  parse: (data: any): ExternalUpdatePayload => {
    // Required fields for external update payload
    const requiredFields = ['piashipmentid', 'status', 'statusTimestamp', 'employeeId'];

    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate timestamp format (ISO 8601)
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!timestampRegex.test(data.statusTimestamp)) {
      throw new Error('Status timestamp must be in ISO 8601 format');
    }

    // Validate location if provided
    if (data.location) {
      if (typeof data.location.latitude !== 'number' || data.location.latitude < -90 || data.location.latitude > 90) {
        throw new Error('Location latitude must be a number between -90 and 90');
      }
      if (typeof data.location.longitude !== 'number' || data.location.longitude < -180 || data.location.longitude > 180) {
        throw new Error('Location longitude must be a number between -180 and 180');
      }
      if (data.location.accuracy !== undefined && (typeof data.location.accuracy !== 'number' || data.location.accuracy < 0)) {
        throw new Error('Location accuracy must be a non-negative number');
      }
    }

    // Validate delivery details if provided
    if (data.deliveryDetails) {
      if (data.deliveryDetails.actualDeliveryTime && !timestampRegex.test(data.deliveryDetails.actualDeliveryTime)) {
        throw new Error('Actual delivery time must be in ISO 8601 format');
      }
    }

    // Validate route info if provided
    if (data.routeInfo) {
      if (data.routeInfo.totalDistance !== undefined && (typeof data.routeInfo.totalDistance !== 'number' || data.routeInfo.totalDistance < 0)) {
        throw new Error('Total distance must be a non-negative number');
      }
      if (data.routeInfo.travelTime !== undefined && (typeof data.routeInfo.travelTime !== 'number' || data.routeInfo.travelTime < 0)) {
        throw new Error('Travel time must be a non-negative number');
      }
    }

    return data as ExternalUpdatePayload;
  },
  validate: (data: any): data is ExternalUpdatePayload => {
    try {
      externalUpdatePayloadSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }
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

export interface VehicleType {
  id: string;
  name: string;
  fuel_efficiency: number;
  description?: string;
  icon: string;
  fuel_type: string;
  co2_emissions?: number;
  created_at: string;
  updated_at: string;
}

export interface InsertVehicleType {
  id: string;
  name: string;
  fuel_efficiency: number;
  description?: string;
  icon?: string;
  fuel_type?: string;
  co2_emissions?: number;
}

export interface UpdateVehicleType {
  name?: string;
  fuel_efficiency?: number;
  description?: string;
  icon?: string;
  fuel_type?: string;
  co2_emissions?: number;
}

export interface DashboardStats {
  totalRoutes: number;
  totalDistance: number;
  totalFuelConsumed: number;
  averageEfficiency: number;
  activeEmployees: number;
  completedShipments: number;
}