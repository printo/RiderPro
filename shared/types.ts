import { GPSPosition, RouteSession, RouteAnalytics, RouteTracking, GPSCoordinate } from './schema';

// Re-export everything from schema
export * from './schema';

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
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  resolved: boolean;
}

export interface ErrorStats {
  total: number;
  recentErrors: number;
  criticalErrors: number;
  resolvedErrors: number;
  byCategory: Record<string, number>;
  byLevel: Record<string, number>;
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
  enableLogging: boolean;
  enableRemoteLogging: boolean;
  maxLocalLogs: number;
  logRetentionDays: number;
  enableAutoRecovery: boolean;
  enableUserNotifications: boolean;
  criticalErrorThreshold: number;
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
  sessionId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  totalDistance: number;
  totalTimeSeconds: number;
  averageSpeed: number;
  coordinateCount: number;
  status: string;
}

export interface SessionSummaryResponse extends RouteAPIResponse {
  summary: SessionSummary;
}

// --- Offline Storage & Sync Types ---
export interface OfflineGPSRecord {
  id: string;
  sessionId: string;
  position: GPSPosition;
  timestamp: string;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: string;
}

export interface OfflineRouteSession {
  id: string;
  employeeId: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'paused';
  startPosition: GPSPosition;
  endPosition?: GPSPosition;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: string;
}

export interface ServerConflict {
  localId: string;
  serverData: unknown;
}

export interface DeviceSyncStatus {
  isOnline: boolean;
  pendingRecords: number;
  lastSyncTime?: Date;
  syncInProgress: boolean;
  syncErrors: string[];
}

// --- Conflict Resolution Types ---
export interface ServerGPSRecord {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  timestamp: string;
  synced: boolean;
}

export type ServerRouteSession = Omit<OfflineRouteSession, 'startPosition' | 'endPosition'> & {
  startPosition: GPSPosition;
  endPosition?: GPSPosition;
};

export type ServerData = ServerGPSRecord | ServerRouteSession;

export interface DataConflict<T = ServerData> {
  id: string;
  type: 'gps_record' | 'route_session';
  localData: OfflineGPSRecord | OfflineRouteSession;
  serverData?: T;
  conflictReason: 'duplicate' | 'timestamp_mismatch' | 'data_mismatch' | 'server_newer';
  timestamp: Date;
}

export interface ConflictResolution<T = ServerData> {
  action: 'use_local' | 'use_server' | 'merge' | 'skip';
  resolvedData?: T;
  reason: string;
}

// --- API Client Types ---
export interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  skipAuth?: boolean;
  retryCount?: number;
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
  retryCount: number;
  timestamp: number;
  userAgent: string;
}

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
  isNetworkError?: boolean;
  isAuthError?: boolean;
  isRetryable?: boolean;
  originalError?: unknown;
  errorType?: ErrorType;
  context?: ErrorContext;
  timestamp?: number;
  userFriendlyMessage?: string;
  recoverySuggestions?: string[];
}

// --- Export Types ---
export type ExportType = 'analytics' | 'coordinates' | 'employee-performance';
export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  filename?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  employeeIds?: string[];
  includeHeaders?: boolean;
  format?: ExportFormat;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  recordCount: number;
  error?: string;
}
