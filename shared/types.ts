import { GPSPosition, RouteSession, RouteAnalytics, RouteTracking, GPSCoordinate, Homebase, RiderHomebaseAssignment } from './schema';

// Re-export everything from schema
export * from './schema';

export type ShipmentStatus =
  | 'Initiated'
  | 'Assigned'
  | 'Collected'
  | 'In Transit'
  | 'Delivered'
  | 'Picked Up'
  | 'Returned'
  | 'Cancelled';

// --- User Types (from Admin.tsx) ---
// Homebase types moved to schema.ts

export interface PendingUser {
  id: string;
  rider_id: string;
  full_name: string;
  email?: string;
  rider_type?: string;
  dispatch_option?: string;
  primary_homebase?: number;
  primary_homebase_details?: Homebase;
  created_at: string;
}

export interface AllUser {
  id: string;
  rider_id: string;
  full_name: string;
  email?: string;
  is_active: number;
  is_approved: number;
  role: string;
  rider_type?: string;
  dispatch_option?: string;
  primary_homebase?: number;
  primary_homebase_details?: Homebase;
  homebase_assignments?: RiderHomebaseAssignment[];
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

// --- Error Handling Types ---
export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: 'gps' | 'network' | 'storage' | 'ui' | 'api' | 'system';
  message: string;
  details?: unknown;
  stack?: string;
  user_agent?: string;
  url?: string;
  user_id?: string;
  session_id?: string;
  resolved: boolean;
}

export interface ErrorStats {
  total: number;
  recent_errors: number;
  critical_errors: number;
  resolved_errors: number;
  by_category: Record<string, number>;
  by_level: Record<string, number>;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  recommendations: string[];
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'ignore' | 'notify';
  description: string;
  action: () => Promise<void> | void;
}

export interface ErrorHandlingConfig {
  enable_logging: boolean;
  enable_remote_logging: boolean;
  max_local_logs: number;
  log_retention_days: number;
  enable_auto_recovery: boolean;
  enable_user_notifications: boolean;
  critical_error_threshold: number;
}

// --- API Response Types ---
export interface RouteAPIResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface SessionResponse extends RouteAPIResponse {
  session: RouteSession;
}

export interface CoordinatesResponse extends RouteAPIResponse {
  coordinates: RouteTracking[];
  count: number;
}

export interface AnalyticsResponse extends RouteAPIResponse {
  analytics: RouteAnalytics[];
  count: number;
}

export interface BatchCoordinateResult {
  success: boolean;
  record?: RouteTracking;
  error?: string;
  coordinate?: GPSCoordinate;
}

export interface BatchCoordinatesResponse extends RouteAPIResponse {
  results: BatchCoordinateResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface SessionSummary {
  session_id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  total_distance: number;
  total_time_seconds: number;
  average_speed: number;
  coordinate_count: number;
  status: string;
}

export interface SessionSummaryResponse extends RouteAPIResponse {
  summary: SessionSummary;
}

// --- Offline Storage & Sync Types ---
export interface OfflineGPSRecord {
  id: string;
  session_id: string;
  position: GPSPosition;
  timestamp: string;
  synced: boolean;
  sync_attempts: number;
  last_sync_attempt?: string;
}

export interface OfflineRouteSession {
  id: string;
  employee_id: string;
  start_time: string;
  end_time?: string;
  status: 'active' | 'completed' | 'paused';
  start_position: GPSPosition;
  end_position?: GPSPosition;
  synced: boolean;
  sync_attempts: number;
  last_sync_attempt?: string;
}

export interface ServerConflict {
  local_id: string;
  server_data: unknown;
}

export interface DeviceSyncStatus {
  is_online: boolean;
  pending_records: number;
  last_sync_at?: Date;
  sync_in_progress: boolean;
  sync_errors: string[];
}

// --- Conflict Resolution Types ---
export interface ServerGPSRecord {
  id: string;
  session_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  timestamp: string;
  synced: boolean;
}

export type ServerRouteSession = Omit<OfflineRouteSession, 'start_position' | 'end_position'> & {
  start_position: GPSPosition;
  end_position?: GPSPosition;
};

export type ServerData = ServerGPSRecord | ServerRouteSession;

export interface DataConflict<T = ServerData> {
  id: string;
  type: 'gps_record' | 'route_session';
  local_data: OfflineGPSRecord | OfflineRouteSession;
  server_data?: T;
  conflict_reason: 'duplicate' | 'timestamp_mismatch' | 'data_mismatch' | 'server_newer';
  timestamp: Date;
}

export interface ConflictResolution<T = ServerData> {
  action: 'use_local' | 'use_server' | 'merge' | 'skip';
  resolved_data?: T;
  reason: string;
}

// --- API Client Types ---
export interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  skip_auth?: boolean;
  retry_count?: number;
  headers?: Record<string, string>;
}

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorContext {
  url: string;
  method: string;
  retry_count: number;
  timestamp: number;
  user_agent: string;
}

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
  is_network_error?: boolean;
  is_auth_error?: boolean;
  is_retryable?: boolean;
  original_error?: unknown;
  error_type?: ErrorType;
  context?: ErrorContext;
  timestamp?: number;
  user_friendly_message?: string;
  recovery_suggestions?: string[];
}

// --- Export Types ---
export type ExportType = 'analytics' | 'coordinates' | 'employee-performance';
export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  filename?: string;
  date_range?: {
    from: Date;
    to: Date;
  };
  employee_ids?: string[];
  include_headers?: boolean;
  format?: ExportFormat;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  record_count: number;
  error?: string;
}
