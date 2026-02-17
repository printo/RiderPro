// Shared schema types for client-server communication

// External system integration interfaces
export interface ExternalShipmentPayload {
  id: string;                    // External tracking ID (maps to database id)
  status: string;
  priority: string;
  type: string;
  pickup_address: string;
  address: string;               // Maps to address in database
  customer_name: string;         // Maps to customer_name in database
  customer_mobile: string;       // Maps to customer_mobile in database
  weight: number;
  dimensions: string;
  special_instructions?: string;
  delivery_time: string;         // Maps to delivery_time in database
  route_name: string;
  employee_id: string;
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
  status_timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  employee_id: string;
  employee_name?: string;
  delivery_details?: {
    actual_delivery_time?: string;
    customer_name?: string;
    delivery_notes?: string;
    signature?: string;
    photo?: string;
    acknowledgment_captured_by?: string;
  };
  route_info?: {
    route_name: string;
    session_id?: string;
    total_distance?: number;
    total_time?: number;
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
  processed_shipments: Array<{
    piashipmentid: string;
    internal_id: string;
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
  processed_updates: Array<{
    piashipmentid: string;
    status: 'sent' | 'failed';
    message: string;
  }>;
  timestamp: string;
}

// Core entities
export interface Homebase {
  id: number;
  pops_homebase_id?: number;
  name: string;
  homebase_id: string;
  aggregator_id?: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  capacity?: number;
  synced_from_pops: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RiderHomebaseAssignment {
  id: number;
  rider: number;
  homebase: number;
  homebase_name: string;
  homebase_code: string;
  is_primary: boolean;
  is_active: boolean;
  pops_rider_id?: number;
  synced_to_pops: boolean;
}

export interface Shipment {
  // Primary key
  id: string;                    // Internal database ID
  shipment_id?: string;          // Optional external/alias ID if provided by backend
  created_at: string;
  updated_at: string;

  // External integration fields
  pops_order_id?: number | string; // External system tracking ID
  status: string;                // Assigned, In Transit, Delivered, etc.
  priority: string;              // high, medium, low
  type: string;                  // delivery, pickup

  // Address fields
  pickup_address?: any;
  address?: any;
  address_display?: string;       // Formatted address for display (backend: addressDisplay)

  // Contact fields
  customer_name: string;          // Maps to customerName, recipientName
  customer_mobile: string;        // Maps to customerMobile, recipientPhone

  // Package fields
  weight: number;
  dimensions?: string;
  special_instructions?: string;
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
  delivery_time?: string;
  actual_delivery_time?: string;

  // Assignment fields
  route_name?: string;
  employee_id?: string;

  // Tracking fields
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled?: number;

  // Acknowledgment fields
  signature_url?: string;
  photo_url?: string;
  pdf_url?: string;
  signed_pdf_url?: string;
  acknowledgment_captured_at?: string;
  acknowledgment_captured_by?: string;
  region?: string;
  homebase?: number;
  homebase_slot?: any;
  homebase_transaction_duration?: number;

  // Sync tracking fields
  synced_to_external?: boolean;
  last_sync_attempt?: string;
  sync_error?: string;
  sync_status?: string;
  sync_attempts?: number;

  // Additional fields for compatibility
  tracking_number?: string;       // Legacy tracking number (backend: trackingNumber)
}

export interface InsertShipment {
  // Required fields
  status: string;
  priority: string;
  type: string;
  pickup_address: any;
  address: any;
  customer_name: string;
  customer_mobile: string;
  weight: number;
  dimensions?: string;

  // Remarks
  remarks?: string;

  // Optional fields
  pops_order_id?: number | string;
  pops_shipment_uuid?: string;
  api_source?: string;
  special_instructions?: string;
  delivery_time?: string;
  actual_delivery_time?: string;

  // Location and assignment fields
  latitude?: number;
  longitude?: number;
  cost?: number;
  route_name?: string;
  employee_id?: string;
  tracking_number?: string;

  // Tracking fields
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled?: number;

  // Acknowledgment fields
  signature_url?: string;
  photo_url?: string;
  acknowledgment_captured_at?: string;
  acknowledgment_captured_by?: string;

  // Sync tracking fields
  synced_to_external?: boolean;
  last_sync_attempt?: string;
  sync_error?: string;
  sync_status?: string;
  sync_attempts?: number;
}

export interface UpdateShipment {
  id?: string;

  // Core fields that can be updated
  status?: string;
  priority?: string;
  type?: string;
  pickup_address?: any;
  address?: any;
  customer_name?: string;
  customer_mobile?: string;
  weight?: number;
  dimensions?: string;
  special_instructions?: string;
  delivery_time?: string;
  actual_delivery_time?: string;
  remarks?: string;

  // External integration fields
  pops_order_id?: number | string;

  // Location and assignment fields
  latitude?: number;
  longitude?: number;
  cost?: number;
  route_name?: string;
  employee_id?: string;
  tracking_number?: string;

  // Acknowledgment fields
  signature_url?: string;
  photo_url?: string;
  acknowledgment_captured_at?: string;
  acknowledgment_captured_by?: string;

  // Sync tracking fields
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
  signature_url?: string;
  photo_url?: string;
  acknowledgment_captured_at: string;
  acknowledgment_captured_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InsertAcknowledgment {
  shipment_id: string;
  signature_url?: string;
  photo_url?: string;
  acknowledgment_captured_at: string;
  acknowledgment_captured_by?: string;
}

export interface DashboardMetrics {
  total_shipments: number;
  pending_shipments?: number;
  delivered_shipments?: number;
  in_transit_shipments?: number;
  completed: number;
  in_progress: number;
  pending: number;
  average_delivery_time?: number;
  on_time_delivery_rate?: number;
  status_breakdown?: Record<string, number>;
  type_breakdown?: Record<string, number>;
  route_breakdown?: Record<string, {
    total: number;
    delivered: number;
    pickedup: number;
    pending: number;
    cancelled: number;
    pickup_pending: number;
    delivery_pending: number;
  }>;
}

export interface ShipmentFilters {
  // Filtering
  status?: string;
  priority?: string;
  type?: string;
  route_name?: string;
  date?: string;
  date_range?: {
    start: string;
    end: string;
  };
  search?: string;
  employee_id?: string;
  pops_order_id?: string | number;
  sync_status?: string;

  // Pagination
  page?: number | string;
  limit?: number | string;

  // Sorting
  sort_field?: string;
  sort_order?: 'ASC' | 'DESC';
}

// Route schemas
export interface startRouteSessionSchema {
  route_id: string;
  driver_id: string;
  vehicle_id: string;
}

export interface stopRouteSessionSchema {
  session_id: string;
  end_location: {
    latitude: number;
    longitude: number;
  };
}

// Aliases for API compatibility
export interface StartRouteSession {
  employee_id: string;
  start_latitude: number;
  start_longitude: number;
  route_id?: string;
  driver_id?: string;
  vehicle_id?: string;
}

export interface StopRouteSession {
  session_id: string;
  end_latitude: number;
  end_longitude: number;
  end_location?: {
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
  date_range?: {
    start: string;
    end: string;
  };
  driver_id?: string;
  status?: string;
}

// Additional route tracking types
export interface RouteTracking {
  id: string;
  session_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  event_type?: string;
  shipment_id?: string;
  date: string;
  vehicle_type?: string;
  fuel_consumption?: number;
  fuel_cost?: number;
  total_distance?: number;
  total_time?: number;
  average_speed?: number;
  shipments_completed?: number;
  fuel_efficiency?: number;
  fuel_price?: number;
}

export interface InsertRouteTracking {
  session_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  event_type?: string;
  shipment_id?: string;
  date: string;
  vehicle_type?: string;
  fuel_consumption?: number;
  fuel_cost?: number;
  total_distance?: number;
  total_time?: number;
  average_speed?: number;
  shipments_completed?: number;
  fuel_efficiency?: number;
  fuel_price?: number;
}

export interface RouteSession {
  id: string;
  employee_id: string;
  employee_name?: string;
  start_time: string;
  end_time?: string;
  status: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude?: number;
  end_longitude?: number;
  total_distance?: number;
  total_time?: number;
  average_speed?: number;
  points?: RoutePoint[]; // RoutePoint array for visualization
  shipments_completed?: number;
  created_at: string;
  updated_at: string;
}

export interface GPSCoordinate {
  id?: string;
  session_id?: string;
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
  date_range?: {
    start: string;
    end: string;
  };
  employee_id?: string;
  status?: string;
  session_status?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
}

// Route Optimization Types
export interface RouteLocation {
  id?: string;
  latitude: number;
  longitude: number;
  shipment_id?: string;
  address?: string;
  customer_name?: string;
}

export interface RouteOptimizeRequest {
  current_latitude: number;
  current_longitude: number;
  locations: RouteLocation[];
}

export interface RouteOptimizeResponse {
  success: boolean;
  ordered_locations: RouteLocation[];
}

export interface BulkShipmentEvent {
  session_id: string;
  shipment_ids: string[];
  event_type: 'pickup' | 'delivery';
  latitude: number;
  longitude: number;
}
// These are placeholder schemas - in a real app you'd use Zod or similar for validation
interface InsertShipmentSchema {
  parse: (data: Record<string, unknown>) => InsertShipment;
  validate: (data: unknown) => data is InsertShipment;
}

export const insertShipmentSchema: InsertShipmentSchema = {
  parse: (data: Record<string, unknown>): InsertShipment => {
    const mutable = { ...(data as unknown as InsertShipment) };

    // Basic validation for required fields
    const requiredFields: Array<keyof InsertShipment> = [
      'status', 'priority', 'type', 'pickup_address',
      'address', 'customer_name', 'customer_mobile', 'weight'
    ];

    const missingFields = requiredFields.filter(field => !(mutable as Record<string, unknown>)[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Type validation
    if (typeof mutable.weight !== 'number' || mutable.weight <= 0) {
      throw new Error('Weight must be a positive number');
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
      route_name: data.route_name as string | undefined,
      date: data.date as string | undefined,
      search: data.search as string | undefined,
      employee_id: data.employee_id as string | undefined,
      page: data.page ? parseInt(String(data.page), 10) : 1,
      limit: data.limit ? parseInt(String(data.limit), 10) : 20,
      sort_field: data.sort_field as string | undefined,
      sort_order: data.sort_order as ShipmentFilters['sort_order'] | undefined
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
      'id', 'status', 'priority', 'type', 'pickup_address', 'address',
      'customer_name', 'customer_mobile', 'weight', 'dimensions', 'delivery_time',
      'route_name', 'employee_id'
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
    const customer_name = String(data.customer_name ?? '');
    if (!phoneRegex.test(customer_name.replace(/\s+/g, ''))) {
      throw new Error('Recipient phone must be a valid phone number');
    }

    const customer_mobile = String(data.customer_mobile ?? '');
    if (!phoneRegex.test(customer_mobile.replace(/\s+/g, ''))) {
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
    const requiredFields = ['piashipmentid', 'status', 'status_timestamp', 'employee_id'];

    const missingFields = requiredFields.filter(field => !(data as Record<string, unknown>)[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate timestamp format (ISO 8601)
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!timestampRegex.test(String(data.status_timestamp))) {
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
    const delivery_details = data.delivery_details as ExternalUpdatePayload['delivery_details'] | undefined;
    if (delivery_details) {
      if (delivery_details.actual_delivery_time && !timestampRegex.test(delivery_details.actual_delivery_time)) {
        throw new Error('Actual delivery time must be in ISO 8601 format');
      }
    }

    // Validate route info if provided
    const route_info = data.route_info as ExternalUpdatePayload['route_info'] | undefined;
    if (route_info) {
      if (route_info.total_distance !== undefined && (typeof route_info.total_distance !== 'number' || route_info.total_distance < 0)) {
        throw new Error('Total distance must be a non-negative number');
      }
      if (route_info.total_time !== undefined && (typeof route_info.total_time !== 'number' || route_info.total_time < 0)) {
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
  route_id: string;
  employee_id: string;
  total_distance: number;
  total_time: number;
  average_speed: number;
  fuel_consumption: number;
  fuel_cost: number;
  stops: number;
  efficiency: number;
  shipments_completed: number;
  date: string;
}

export interface DailyRouteSummary {
  employee_id: string;
  date: string; // YYYY-MM-DD
  total_sessions?: number;
  total_distance: number; // km
  total_time: number; // seconds
  total_fuel_consumed?: number; // liters
  total_fuel_cost?: number; // currency
  shipments_completed: number;
  average_speed?: number; // km/h
  efficiency: number; // km per shipment
  stationary_time?: number; // seconds
  moving_time?: number; // seconds
  max_speed?: number; // km/h
  sessions?: RouteSessionSummary[];
}

export interface WeeklyRouteSummary {
  employee_id: string;
  week_start: string; // YYYY-MM-DD
  week_end?: string; // YYYY-MM-DD
  daily_summaries?: DailyRouteSummary[];
  total_sessions?: number;
  total_distance: number;
  total_time: number;
  total_fuel_consumed?: number;
  total_fuel_cost?: number;
  total_shipments_completed?: number;
  average_speed?: number;
  efficiency: number;
}

export interface MonthlyRouteSummary {
  employee_id: string;
  month: string; // YYYY-MM
  weekly_summaries?: WeeklyRouteSummary[];
  total_sessions?: number;
  total_distance: number;
  total_time: number;
  total_fuel_consumed?: number;
  total_fuel_cost?: number;
  total_shipments_completed?: number;
  average_speed?: number;
  efficiency: number;
  working_days?: number;
}

export interface RouteSessionSummary {
  session_id: string;
  employee_id: string;
  date?: string;
  start_time: string;
  end_time?: string;
  total_distance?: number;
  total_time?: number;
  average_speed?: number; // km/h
  max_speed?: number; // km/h
  fuel_consumption?: number; // liters
  fuel_cost?: number; // currency
  shipments_completed?: number;
  coordinate_count?: number;
  efficiency?: number; // km per shipment
}

export interface RouteMetrics {
  session_id?: string;
  route_id?: string;
  employee_id: string;
  date: string;
  distance?: number;
  duration?: number;
  fuel_used?: number;
  average_speed: number;
  stops?: number;
  efficiency: number;
  total_distance: number;
  total_time: number;
  fuel_consumed: number;
  fuel_cost: number;
  shipments_completed: number;
}

export interface EmployeePerformance {
  employee_id: string;
  name?: string;
  total_routes?: number;
  total_distance: number;
  total_time?: number;
  fuel_consumption?: number;
  fuel_cost?: number;
  shipments_completed?: number;
  average_speed?: number;
  average_efficiency?: number;
  efficiency?: number; // km per shipment
  on_time_deliveries?: number;
  total_deliveries?: number;
  fuel_efficiency?: number;
  fuel_efficiency_rating?: 'excellent' | 'good' | 'average' | 'poor';
  rating?: number;
  performance_score?: number; // 0-100
  working_days?: number;
  average_distance_per_day?: number;
  average_shipments_per_day?: number;
}

export type EmployeeMetrics = EmployeePerformance;

export interface FuelAnalytics {
  date?: string;
  consumption?: number;
  cost?: number;
  efficiency?: number;
  distance?: number;
  total_fuel_consumed?: number;
  total_fuel_cost?: number;
  total_distance?: number;
  average_efficiency?: number;
  total_co2_emissions?: number;
  cost_per_km?: number;
  fuel_per_km?: number;
  daily_breakdown?: Array<{
    date: string;
    fuel_consumed: number;
    fuel_cost: number;
    distance: number;
  }>;
  breakdown?: {
    by_vehicle_type: Record<string, {
      fuel_consumed: number;
      fuel_cost: number;
      efficiency: number;
      distance: number;
    }>;
    by_time_range: Array<{
      period: string;
      consumption: number;
    }>;
  };
  by_vehicle_type?: Record<string, {
    fuel_consumed: number;
    fuel_cost: number;
    efficiency: number;
    distance: number;
  }>;
  by_employee?: Record<string, {
    fuel_consumed: number;
    fuel_cost: number;
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

export interface PerformanceMetrics {
  date: string;
  average_speed: number;
  efficiency: number;
  delivery_time: number;
  customer_satisfaction: number;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  date_range: {
    start: string;
    end: string;
  };
  include_routes: boolean;
  include_analytics: boolean;
  include_performance: boolean;
}

export interface ExportProgress {
  stage: string;
  progress: number;
  total: number;
  message: string;
}

export interface AnalyticsFilters {
  date_range?: {
    start: string;
    end: string;
  };
  employee_id?: string;
  route_id?: string;
  metric_type?: 'fuel' | 'performance' | 'efficiency';
  start_date?: string;
  end_date?: string;
  vehicle_type?: string;
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
  total_routes: number;
  total_distance: number;
  total_fuel_consumed: number;
  average_efficiency: number;
  active_employees: number;
  completed_shipments: number;
}

// User and Authentication Types
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  RIDER = 'rider',
  VIEWER = 'viewer'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employee_id: string;
  full_name: string;
  is_active: boolean;
  is_approved: boolean;
  // Simplified role structure
  is_rider: boolean;
  is_super_user: boolean;
  // Original PIA roles for server-side filtering
  is_ops_team?: boolean;
  is_staff?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  employee_id: string;
  full_name: string;
  is_active: boolean;
  is_approved: boolean;
  is_rider: boolean;
  is_super_user: boolean;
  is_ops_team?: boolean;
  is_staff?: boolean;
  created_at: string;
  updated_at: string;
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
  access_token?: string | null;
  refresh_token?: string | null;
  is_authenticated: boolean;
  is_loading: boolean;
  error?: string | null;
}

export interface PrivacySettings {
  data_retention: number;
  location_tracking: boolean;
  analytics_tracking: boolean;
  marketing_emails: boolean;
  data_sharing: boolean;
  gps_tracking_consent: boolean;
  data_analytics_consent: boolean;
  data_export_consent: boolean;
  performance_monitoring_consent: boolean;
  last_updated: string;
}

export interface ConsentType {
  id: string;
  type: string;
  description: string;
  required: boolean;
  granted: boolean;
  granted_at?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  resource?: string;
  date_range?: {
    start: string;
    end: string;
  };
  page?: number;
  limit?: number;
}

export interface AuditStatistics {
  total_entries: number;
  unique_users: number;
  action_breakdown: Record<string, number>;
  resource_breakdown: Record<string, number>;
  time_range: {
    start: string;
    end: string;
  };
}

// Rider/Employee specific types
export interface Rider {
  id: string;
  rider_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  primary_homebase_details?: Homebase;
  dispatch_option?: string;
  created_at: string;
  updated_at?: string;
  last_login_at?: string | null;
  is_super_user?: boolean;
}

export interface UserProfile {
  full_name: string;
  employee_id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_staff?: boolean;
  is_super_user?: boolean;
  is_ops_team?: boolean;
  access_token?: string;
  refresh_token?: string;
}

// Visualization Types
export interface RoutePoint {
  id?: string;
  session_id?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
  event_type?: 'pickup' | 'delivery' | 'gps' | string;
  shipment_id?: string;
}

export interface RouteData {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  total_distance: number;
  total_time: number;
  shipments_completed: number;
  fuel_consumption: number;
  average_speed: number;
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
  pickedup: number;
  pending?: number;
  delivery_pending?: number;
  pickup_pending?: number;
  cancelled?: number;
}

// Fuel Types
export type FuelType = 'gasoline' | 'diesel' | 'electric';
export type City = 'Delhi' | 'Bangalore' | 'Chennai';

export interface FuelPrice {
  fuel_type: FuelType;
  city: City;
  price_per_unit: number;
  gst_percent: number;
  currency: 'INR';
  last_updated: string;
}

export interface FuelConsumptionResult {
  distance: number;
  fuel_consumed: number;
  fuel_cost: number;
  formatted_cost: string;       // formatted for INR
  co2_emissions?: number;
  efficiency: number;
}

export interface FuelOptimizationSuggestion {
  id?: string;
  type: 'efficiency' | 'cost' | 'emissions';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  potential_saving: {
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
  vehicle_id?: string;
  vehicle_type?: string;
  total_distance: number;
  total_fuel_consumed: number;
  total_fuel_cost: number;
  total_co2_emissions?: number;
  average_efficiency: number;
  cost_per_km: number;
  fuel_per_km: number;
  formatted_total_cost: string; // formatted INR
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
  potential_savings: {
    distance?: number; // km
    time?: number; // minutes
    fuel?: number; // liters
    cost?: number; // currency
  };
  confidence: number; // 0-100
  affected_employees: string[];
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

export interface ReportColumn {
  title: string;
  data_index: string;
  key: string;
  render?: (value: string | number) => React.ReactNode;
}

export interface ReportData {
  key: number;
  month?: string;
  vehicle_type?: string;
  city?: string;
  total_distance: number;
  total_fuel_consumed: number;
  total_fuel_cost: number;
  average_efficiency: number;
  cost_per_km: number;
  [key: string]: string | number | undefined;
}
