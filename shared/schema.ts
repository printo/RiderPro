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
    acknowledgment_captured_by?: string;
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
  package_boxes?: Array<{
    sku?: string;
    name?: string;
    quantity?: number;
    dimensions?: {
      length?: number;
      breadth?: number;
      height?: number;
    };
    length?: number;
    breadth?: number;
    width?: number;
    height?: number;
    weight?: number;
    volume?: number;
    price?: number;
  }>;

  // Remarks
  remarks?: string;

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
  orderId?: string | number;      // Alias for pops_order_id

  // Tracking fields
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled?: number;

  // Acknowledgment fields (merged from acknowledgments table)
  signatureUrl?: string;
  photoUrl?: string;
  signedPdfUrl?: string;
  acknowledgment_captured_at?: string;
  acknowledgment_captured_by?: string;

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

  // Remarks
  remarks?: string;

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

  // Tracking fields
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled?: number;

  // Acknowledgment fields
  signatureUrl?: string;
  photoUrl?: string;
  acknowledgment_captured_at?: string;
  acknowledgment_captured_by?: string;

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
  remarks?: string;

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

  // Acknowledgment fields (consolidated from acknowledgments table)
  signature_url?: string;
  photo_url?: string;
  acknowledgment_captured_at?: string;
  acknowledgment_captured_by?: string;

  // Sync tracking fields (consolidated from sync_status table)
  synced_to_external?: boolean;
  last_sync_attempt?: string;
  sync_error?: string | null;
  sync_status?: string;
  sync_attempts?: number;
}

export interface BatchUpdate {
  updates: UpdateShipment[];
}

// Acknowledgment interfaces (for backward compatibility)
export interface Acknowledgment {
  id: string;
  shipment_id: string;
  signatureUrl?: string;
  photoUrl?: string;
  acknowledgment_captured_at: string;
  acknowledgment_captured_by?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsertAcknowledgment {
  shipment_id: string;
  signatureUrl?: string;
  photoUrl?: string;
  acknowledgment_captured_at: string;
  acknowledgment_captured_by?: string;
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
  routeBreakdown?: Record<string, {
    total: number;
    delivered: number;
    pickedUp: number;
    pending: number;
    cancelled: number;
    pickupPending: number;
    deliveryPending: number;
  }>;
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
  orderId?: string | number; // Pia order ID filter
  syncStatus?: string; // pending, failed, synced

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
  employeeName?: string;
  startTime: string;
  endTime?: string;
  status: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  totalDistance?: number;
  totalTime?: number;
  averageSpeed?: number;
  points?: RoutePoint[]; // RoutePoint array for visualization
  shipmentsCompleted?: number;
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

// GPS related types
export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  timestamp: string;
}

export interface GPSError {
  code: number;
  message: string;
}

export type GPSPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

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
interface InsertShipmentSchema {
  parse: (data: Record<string, unknown>) => InsertShipment;
  validate: (data: unknown) => data is InsertShipment;
}

export const insertShipmentSchema: InsertShipmentSchema = {
  parse: (data: Record<string, unknown>): InsertShipment => {
    const mutable = { ...(data as unknown as InsertShipment) };
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
    const requiredFields: Array<keyof InsertShipment> = [
      'status', 'priority', 'type', 'pickupAddress',
      'deliveryAddress', 'recipientName', 'recipientPhone', 'weight', 'dimensions'
    ];

    const missingFields = requiredFields.filter(field => !(mutable as Record<string, unknown>)[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Type validation
    if (typeof mutable.weight !== 'number' || mutable.weight <= 0) {
      throw new Error('Weight must be a positive number');
    }

    if (mutable.trackingNumber && (typeof mutable.trackingNumber !== 'string' || mutable.trackingNumber.trim() === '')) {
      throw new Error('Tracking number must be a non-empty string');
    }

    // Validate latitude and longitude if provided
    if (mutable.latitude !== undefined && mutable.latitude !== null) {
      const lat = Number(mutable.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('Latitude must be a number between -90 and 90');
      }
      mutable.latitude = lat;
    }

    if (mutable.longitude !== undefined && mutable.longitude !== null) {
      const lng = Number(mutable.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new Error('Longitude must be a number between -180 and 180');
      }
      mutable.longitude = lng;
    }

    // Validate priority values
    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(mutable.priority.toLowerCase())) {
      throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate type values
    const validTypes = ['delivery', 'pickup'];
    if (!validTypes.includes(mutable.type.toLowerCase())) {
      throw new Error(`Type must be one of: ${validTypes.join(', ')}`);
    }

    // Return validated data
    return mutable;
  },
  validate: (data: unknown): data is InsertShipment => {
    try {
      insertShipmentSchema.parse(data as Record<string, unknown>);
      return true;
    } catch {
      return false;
    }
  }
};

interface UpdateShipmentSchema {
  parse: (data: UpdateShipment) => UpdateShipment;
  validate: (data: unknown) => data is UpdateShipment;
}

export const updateShipmentSchema: UpdateShipmentSchema = {
  parse: (data: UpdateShipment): UpdateShipment => {
    // For status-only updates, we don't require shipment_id in body
    // as it comes from the URL parameter
    return data;
  },
  validate: (_data: unknown): _data is UpdateShipment => true
};

interface BatchUpdateSchema {
  parse: (data: unknown) => BatchUpdate;
  validate: (data: unknown) => data is BatchUpdate;
}

export const batchUpdateSchema: BatchUpdateSchema = {
  parse: (data: unknown): BatchUpdate => {
    const { updates } = data as BatchUpdate;
    if (!updates || !Array.isArray(updates)) {
      throw new Error('Batch must contain an updates array');
    }
    return { updates };
  },
  validate: (_data: unknown): _data is BatchUpdate => true
};

// insertAcknowledgmentSchema removed - functionality consolidated into shipments

interface ShipmentFiltersSchema {
  parse: (data: Record<string, unknown>) => ShipmentFilters;
  validate: (data: unknown) => data is ShipmentFilters;
}

export const shipmentFiltersSchema: ShipmentFiltersSchema = {
  parse: (data: Record<string, unknown>): ShipmentFilters => {
    return {
      status: data.status as string | undefined,
      priority: data.priority as string | undefined,
      type: data.type as string | undefined,
      routeName: data.routeName as string | undefined,
      date: data.date as string | undefined,
      search: data.search as string | undefined,
      employeeId: data.employeeId as string | undefined,
      page: data.page ? parseInt(String(data.page), 10) : 1,
      limit: data.limit ? parseInt(String(data.limit), 10) : 20,
      sortField: data.sortField as string | undefined,
      sortOrder: data.sortOrder as ShipmentFilters['sortOrder'] | undefined
    };
  },
  validate: (_data: unknown): _data is ShipmentFilters => true
};

export const startRouteSessionSchemaValidator = {
  validate: (_data: unknown): _data is startRouteSessionSchema => true
};

export const stopRouteSessionSchemaValidator = {
  validate: (_data: unknown): _data is stopRouteSessionSchema => true
};

export const gpsCoordinateSchemaValidator = {
  validate: (_data: unknown): _data is gpsCoordinateSchema => true
};

export const routeFiltersSchemaValidator = {
  validate: (_data: unknown): _data is routeFiltersSchema => true
};

// External system integration validation schemas
interface ExternalShipmentPayloadSchema {
  parse: (data: Record<string, unknown>) => ExternalShipmentPayload;
  validate: (data: unknown) => data is ExternalShipmentPayload;
}

export const externalShipmentPayloadSchema: ExternalShipmentPayloadSchema = {
  parse: (data: Record<string, unknown>): ExternalShipmentPayload => {
    // Required fields for external shipment payload
    const requiredFields: Array<keyof ExternalShipmentPayload> = [
      'id', 'status', 'priority', 'type', 'pickupAddress', 'deliveryAddress',
      'recipientName', 'recipientPhone', 'weight', 'dimensions', 'estimatedDeliveryTime',
      'customerName', 'customerMobile', 'address', 'latitude', 'longitude',
      'cost', 'deliveryTime', 'routeName', 'employeeId'
    ];

    const missingFields = requiredFields.filter(field => !(data as Record<string, unknown>)[field] && (data as Record<string, unknown>)[field] !== 0);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Type validation
    const weight = data.weight as number;
    if (typeof weight !== 'number' || weight <= 0) {
      throw new Error('Weight must be a positive number');
    }

    const cost = data.cost as number;
    if (typeof cost !== 'number' || cost < 0) {
      throw new Error('Cost must be a non-negative number');
    }

    // Validate latitude and longitude
    const lat = Number(data.latitude as number | string);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new Error('Latitude must be a number between -90 and 90');
    }

    const lng = Number(data.longitude as number | string);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      throw new Error('Longitude must be a number between -180 and 180');
    }

    // Validate priority values
    const validPriorities = ['high', 'medium', 'low'];
    const priority = String(data.priority ?? '');
    if (!validPriorities.includes(priority.toLowerCase())) {
      throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate type values
    const validTypes = ['delivery', 'pickup'];
    const type = String(data.type ?? '');
    if (!validTypes.includes(type.toLowerCase())) {
      throw new Error(`Type must be one of: ${validTypes.join(', ')}`);
    }

    // Validate phone number format (basic validation for Indian numbers)
    const phoneRegex = /^[+]?[0-9]{10,15}$/;
    const recipientPhone = String(data.recipientPhone ?? '');
    if (!phoneRegex.test(recipientPhone.replace(/\s+/g, ''))) {
      throw new Error('Recipient phone must be a valid phone number');
    }

    const customerMobile = String(data.customerMobile ?? '');
    if (!phoneRegex.test(customerMobile.replace(/\s+/g, ''))) {
      throw new Error('Customer mobile must be a valid phone number');
    }

    return data as unknown as ExternalShipmentPayload;
  },
  validate: (data: unknown): data is ExternalShipmentPayload => {
    try {
      externalShipmentPayloadSchema.parse(data as Record<string, unknown>);
      return true;
    } catch {
      return false;
    }
  }
};

export interface ExternalShipmentBatchSchema {
  parse: (data: unknown) => ExternalShipmentBatch;
  validate: (data: unknown) => data is ExternalShipmentBatch;
}

export const externalShipmentBatchSchema: ExternalShipmentBatchSchema = {
  parse: (data: unknown): ExternalShipmentBatch => {
    const { shipments, metadata } = data as ExternalShipmentBatch;
    if (!shipments || !Array.isArray(shipments)) {
      throw new Error('Batch must contain a shipments array');
    }
    if (shipments.length > 100) {
      throw new Error('Batch size cannot exceed 100 shipments');
    }

    // Validate each shipment in the batch
    shipments.forEach((shipment, index) => {
      try {
        externalShipmentPayloadSchema.parse(shipment as unknown as Record<string, unknown>);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        throw new Error(`Shipment at index ${index}: ${errorMessage}`);
      }
    });

    // Validate metadata if provided
    if (metadata) {
      if (!metadata.source || typeof metadata.source !== 'string') {
        throw new Error('Metadata source must be a non-empty string');
      }
      if (!metadata.batchId || typeof metadata.batchId !== 'string') {
        throw new Error('Metadata batchId must be a non-empty string');
      }
    }

    return data as unknown as ExternalShipmentBatch;
  },
  validate: (data: unknown): data is ExternalShipmentBatch => {
    try {
      externalShipmentBatchSchema.parse(data as Record<string, unknown>);
      return true;
    } catch {
      return false;
    }
  }
};

interface ExternalUpdatePayloadSchema {
  parse: (data: Record<string, unknown>) => ExternalUpdatePayload;
  validate: (data: unknown) => data is ExternalUpdatePayload;
}

export const externalUpdatePayloadSchema: ExternalUpdatePayloadSchema = {
  parse: (data: Record<string, unknown>): ExternalUpdatePayload => {
    // Required fields for external update payload
    const requiredFields = ['piashipmentid', 'status', 'statusTimestamp', 'employeeId'];

    const missingFields = requiredFields.filter(field => !(data as Record<string, unknown>)[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate timestamp format (ISO 8601)
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!timestampRegex.test(String(data.statusTimestamp))) {
      throw new Error('Status timestamp must be in ISO 8601 format');
    }

    // Validate location if provided
    const location = data.location as ExternalUpdatePayload['location'] | undefined;
    if (location) {
      if (typeof location.latitude !== 'number' || location.latitude < -90 || location.latitude > 90) {
        throw new Error('Location latitude must be a number between -90 and 90');
      }
      if (typeof location.longitude !== 'number' || location.longitude < -180 || location.longitude > 180) {
        throw new Error('Location longitude must be a number between -180 and 180');
      }
      if (location.accuracy !== undefined && (typeof location.accuracy !== 'number' || location.accuracy < 0)) {
        throw new Error('Location accuracy must be a non-negative number');
      }
    }

    // Validate delivery details if provided
    const deliveryDetails = data.deliveryDetails as ExternalUpdatePayload['deliveryDetails'] | undefined;
    if (deliveryDetails) {
      if (deliveryDetails.actualDeliveryTime && !timestampRegex.test(deliveryDetails.actualDeliveryTime)) {
        throw new Error('Actual delivery time must be in ISO 8601 format');
      }
    }

    // Validate route info if provided
    const routeInfo = data.routeInfo as ExternalUpdatePayload['routeInfo'] | undefined;
    if (routeInfo) {
      if (routeInfo.totalDistance !== undefined && (typeof routeInfo.totalDistance !== 'number' || routeInfo.totalDistance < 0)) {
        throw new Error('Total distance must be a non-negative number');
      }
      if (routeInfo.travelTime !== undefined && (typeof routeInfo.travelTime !== 'number' || routeInfo.travelTime < 0)) {
        throw new Error('Travel time must be a non-negative number');
      }
    }

    return data as unknown as ExternalUpdatePayload;
  },
  validate: (data: unknown): data is ExternalUpdatePayload => {
    try {
      externalUpdatePayloadSchema.parse(data as Record<string, unknown>);
      return true;
    } catch {
      return false;
    }
  }
};

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

export interface DailyRouteSummary {
  employeeId: string;
  date: string; // YYYY-MM-DD
  totalSessions?: number;
  totalDistance: number; // km
  totalTime: number; // seconds
  totalFuelConsumed?: number; // liters
  totalFuelCost?: number; // currency
  fuelConsumed?: number; // alias for totalFuelConsumed
  fuelCost?: number; // alias for totalFuelCost
  shipmentsCompleted: number;
  averageSpeed?: number; // km/h
  efficiency: number; // km per shipment
  stationaryTime?: number; // seconds
  movingTime?: number; // seconds
  maxSpeed?: number; // km/h
  sessions?: RouteSessionSummary[];
}

export interface WeeklyRouteSummary {
  employeeId: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd?: string; // YYYY-MM-DD
  dailySummaries?: DailyRouteSummary[];
  totalSessions?: number;
  totalDistance: number;
  totalTime: number;
  totalFuelConsumed?: number;
  totalFuelCost?: number;
  fuelConsumed?: number; // alias
  fuelCost?: number; // alias
  totalShipmentsCompleted?: number;
  shipmentsCompleted?: number; // alias
  averageSpeed?: number;
  efficiency: number;
}

export interface MonthlyRouteSummary {
  employeeId: string;
  month: string; // YYYY-MM
  weeklySummaries?: WeeklyRouteSummary[];
  totalSessions?: number;
  totalDistance: number;
  totalTime: number;
  totalFuelConsumed?: number;
  totalFuelCost?: number;
  fuelConsumed?: number; // alias
  fuelCost?: number; // alias
  totalShipmentsCompleted?: number;
  shipmentsCompleted?: number; // alias
  averageSpeed?: number;
  efficiency: number;
  workingDays?: number;
}

export interface RouteSessionSummary {
  sessionId: string;
  employeeId: string;
  date?: string;
  startTime: string;
  endTime?: string;
  distance?: number; // km
  duration?: number; // seconds
  totalDistance?: number; // alias for distance
  totalTime?: number; // alias for duration
  averageSpeed?: number; // km/h
  maxSpeed?: number; // km/h
  fuelConsumed?: number; // liters
  fuelCost?: number; // currency
  shipmentsCompleted?: number;
  coordinateCount?: number;
  efficiency?: number; // km per shipment
}

export interface RouteMetrics {
  sessionId?: string;
  routeId?: string;
  employeeId: string;
  date: string;
  distance?: number;
  duration?: number;
  fuelUsed?: number;
  averageSpeed: number;
  stops?: number;
  efficiency: number;
  totalDistance: number;
  totalTime: number;
  fuelConsumed: number;
  fuelCost: number;
  shipmentsCompleted: number;
}

export interface EmployeePerformance {
  employeeId: string;
  name?: string;
  totalRoutes?: number;
  totalDistance: number;
  totalTime?: number;
  totalFuelConsumed?: number;
  totalFuelCost?: number;
  totalShipmentsCompleted?: number;
  averageSpeed?: number;
  averageEfficiency?: number;
  efficiency?: number; // km per shipment
  onTimeDeliveries?: number;
  totalDeliveries?: number;
  fuelEfficiency?: number;
  fuelEfficiencyRating?: 'excellent' | 'good' | 'average' | 'poor';
  rating?: number;
  performanceScore?: number; // 0-100
  workingDays?: number;
  averageDistancePerDay?: number;
  averageShipmentsPerDay?: number;
}

// Alias for backward compatibility
export type EmployeePerformanceMetrics = EmployeePerformance;
export interface EmployeeMetrics extends EmployeePerformance {
  // Additional fields used in EmployeePerformanceTable (aliases for compatibility)
  fuelConsumed?: number; // alias for totalFuelConsumed
  fuelCost?: number; // alias for totalFuelCost
  shipmentsCompleted?: number; // alias for totalShipmentsCompleted
  avgDistancePerDay?: number; // alias for averageDistancePerDay
  avgShipmentsPerDay?: number; // alias for averageShipmentsPerDay
}

export interface FuelAnalytics {
  date?: string;
  consumption?: number;
  cost?: number;
  efficiency?: number;
  distance?: number;
  totalFuelConsumed?: number;
  totalFuelCost?: number;
  totalDistance?: number;
  averageEfficiency?: number;
  totalCO2Emissions?: number;
  costPerKm?: number;
  fuelPerKm?: number;
  dailyBreakdown?: Array<{
    date: string;
    fuelConsumed: number;
    fuelCost: number;
    distance: number;
  }>;
  breakdown?: {
    byVehicleType: Record<string, {
      fuelConsumed: number;
      fuelCost: number;
      efficiency: number;
      distance: number;
    }>;
    byTimeRange: Array<{
      period: string;
      consumption: number;
    }>;
  };
  byVehicleType?: Record<string, {
    fuelConsumed: number;
    fuelCost: number;
    efficiency: number;
    distance: number;
  }>;
  byEmployee?: Record<string, {
    fuelConsumed: number;
    fuelCost: number;
    efficiency: number;
    distance: number;
  }>;
  trends?: Array<{
    period: string;
    consumption: number;
    cost: number;
    efficiency: number;
  }>;
}

// Alias for backward compatibility
export type FuelAnalyticsData = FuelAnalytics;

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

export interface AnalyticsFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  employeeId?: string;
  routeId?: string;
  metricType?: 'fuel' | 'performance' | 'efficiency';
  startDate?: string;
  endDate?: string;
  vehicleType?: string;
  city?: string;
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

export interface FuelSetting {
  id: string;
  fuel_type: string;
  price_per_liter: number;
  currency: string;
  region?: string;
  effective_date: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InsertFuelSetting {
  id?: string;
  fuel_type: string;
  price_per_liter: number;
  currency?: string;
  region?: string;
  effective_date: string;
  is_active?: boolean;
  created_by?: string;
}

export interface UpdateFuelSetting {
  fuel_type?: string;
  price_per_liter?: number;
  currency?: string;
  region?: string;
  effective_date?: string;
  is_active?: boolean;
}

export interface DashboardStats {
  totalRoutes: number;
  totalDistance: number;
  totalFuelConsumed: number;
  averageEfficiency: number;
  activeEmployees: number;
  completedShipments: number;
}

// User and Authentication Types
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  VIEWER = 'viewer'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId: string;
  fullName: string;
  isActive: boolean;
  isApproved: boolean;
  // Simplified role structure
  isRider: boolean;
  isSuperUser: boolean;
  // Original PIA roles for server-side filtering
  isOpsTeam?: boolean;
  isStaff?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  employeeId: string;
  fullName: string;
  isActive: boolean;
  isApproved: boolean;
  isRider: boolean;
  isSuperUser: boolean;
  isOpsTeam?: boolean;
  isStaff?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string | null;
}

export interface PrivacySettings {
  dataRetention: number;
  locationTracking: boolean;
  analyticsTracking: boolean;
  marketingEmails: boolean;
  dataSharing: boolean;
  gpsTrackingConsent: boolean;
  dataAnalyticsConsent: boolean;
  dataExportConsent: boolean;
  performanceMonitoringConsent: boolean;
  lastUpdated: string;
}

export interface ConsentType {
  id: string;
  type: string;
  description: string;
  required: boolean;
  granted: boolean;
  grantedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  page?: number;
  limit?: number;
}

export interface AuditStatistics {
  totalEntries: number;
  uniqueUsers: number;
  actionBreakdown: Record<string, number>;
  resourceBreakdown: Record<string, number>;
  timeRange: {
    start: string;
    end: string;
  };
}

// Rider/Employee specific types
export interface Rider {
  id: string;
  rider_id: string;
  full_name: string;
  name?: string; // alias for full_name
  email: string;
  is_active: boolean;
  isActive?: boolean; // alias for is_active
  isApproved?: boolean;
  created_at: string;
  createdAt?: string; // alias for created_at
  updated_at?: string;
  updatedAt?: string; // alias for updated_at
  last_login_at?: string | null;
  is_super_user?: boolean;
}

export interface UserProfile {
  fullName: string;
  employeeId: string;
  email: string;
  role: string;
  isActive: boolean;
  isStaff?: boolean;
  isSuperUser?: boolean;
  isOpsTeam?: boolean;
  accessToken?: string;
  refreshToken?: string;
}

// Visualization Types
export interface RoutePoint {
  id?: string;
  sessionId?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
  eventType?: 'pickup' | 'delivery' | 'gps' | string;
  shipmentId?: string;
}

export interface RouteData {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  distance: number;
  duration: number;
  shipmentsCompleted: number;
  fuelConsumption: number;
  averageSpeed: number;
  efficiency: number; // km per shipment
  points: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
  }>;
}

export interface RouteStatusBreakdown {
  total: number;
  delivered: number;
  pickedUp: number;
  pending?: number;
  deliveryPending?: number;
  pickupPending?: number;
  cancelled?: number;
}

// Fuel Types
export type FuelType = 'gasoline' | 'diesel' | 'electric';
export type City = 'Delhi' | 'Bangalore' | 'Chennai';

export interface FuelPrice {
  fuelType: FuelType;
  city: City;
  pricePerUnit: number;
  gstPercent: number;
  currency: 'INR';
  lastUpdated: string;
}

export interface FuelConsumptionResult {
  distance: number;
  fuelConsumed: number;
  fuelCost: number;
  formattedCost: string;       // formatted for INR
  co2Emissions?: number;
  efficiency: number;
}

export interface FuelOptimizationSuggestion {
  id?: string;
  type: 'efficiency' | 'cost' | 'emissions';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  potentialSaving: {
    fuel?: number;
    cost?: number;
    co2?: number;
    distance?: number;
  };
  recommendation: string;
  status?: 'pending' | 'in-progress' | 'completed';
}

// Fleet Report Types
export interface FleetReport {
  city?: City;
  vehicleId?: string;
  vehicleType?: string;
  totalDistance: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalCO2Emissions?: number;
  averageEfficiency: number;
  costPerKm: number;
  fuelPerKm: number;
  formattedTotalCost: string; // formatted INR
}

export interface MonthlyFleetReport extends FleetReport {
  month: number; // 1-12
  year: number;
}

export interface OptimizationSuggestion {
  id: string;
  type: 'route_consolidation' | 'speed_optimization' | 'fuel_efficiency' | 'time_management' | 'distance_reduction';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings: {
    distance?: number; // km
    time?: number; // minutes
    fuel?: number; // liters
    cost?: number; // currency
  };
  confidence: number; // 0-100
  affectedEmployees: string[];
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

export interface ReportColumn {
  title: string;
  dataIndex: string;
  key: string;
  render?: (value: string | number) => React.ReactNode;
}

export interface ReportData {
  key: number;
  month?: string;
  vehicleType?: string;
  city?: string;
  totalDistance: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageEfficiency: number;
  costPerKm: number;
  [key: string]: string | number | undefined;
}