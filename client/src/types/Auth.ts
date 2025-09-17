// User roles for role-based access control
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  VIEWER = 'viewer',
}

// Permissions for different actions
export enum Permission {
  VIEW_ALL_ROUTES = 'view_all_routes',
  VIEW_OWN_ROUTES = 'view_own_routes',
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
  MANAGE_USERS = 'manage_users',
  VIEW_LIVE_TRACKING = 'view_live_tracking',
  ACCESS_AUDIT_LOGS = 'access_audit_logs',
  CONFIGURE_SYSTEM = 'configure_system',
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  fullName?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  employeeId?: string;
}

export interface UpdateUserData {
  role?: UserRole;
  isActive?: boolean;
  employeeId?: string;
}

// Privacy and consent types
export enum ConsentType {
  GPS_TRACKING = 'gps_tracking',
  DATA_ANALYTICS = 'data_analytics',
  DATA_EXPORT = 'data_export',
  PERFORMANCE_MONITORING = 'performance_monitoring',
}

export interface PrivacySettings {
  employeeId: string;
  gpsTrackingConsent: boolean;
  dataAnalyticsConsent: boolean;
  dataExportConsent: boolean;
  performanceMonitoringConsent: boolean;
  dataRetentionDays: number;
  anonymizeAfterDays?: number;
  consentDate: string;
  lastUpdated: string;
  ipAddress?: string;
}

// Audit log types
export enum AuditEventType {
  // Authentication events
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',

  // Route data access
  ROUTE_DATA_VIEWED = 'route_data_viewed',
  ROUTE_DATA_EXPORTED = 'route_data_exported',
  ANALYTICS_VIEWED = 'analytics_viewed',
  LIVE_TRACKING_ACCESSED = 'live_tracking_accessed',

  // Data modifications
  ROUTE_SESSION_STARTED = 'route_session_started',
  ROUTE_SESSION_STOPPED = 'route_session_stopped',
  GPS_DATA_SUBMITTED = 'gps_data_submitted',

  // Administrative actions
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  PERMISSIONS_CHANGED = 'permissions_changed',
  SYSTEM_CONFIG_CHANGED = 'system_config_changed',

  // Privacy actions
  DATA_RETENTION_APPLIED = 'data_retention_applied',
  DATA_ANONYMIZED = 'data_anonymized',
  CONSENT_GRANTED = 'consent_granted',
  CONSENT_REVOKED = 'consent_revoked',

  // Security events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
}

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  userId?: string;
  username?: string;
  employeeId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLogFilters {
  userId?: string;
  employeeId?: string;
  eventType?: AuditEventType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  eventTypes: Array<{
    event_type: string;
    count: number;
    successful: number;
    failed: number;
  }>;
  totals: {
    total_events: number;
    unique_users: number;
    unique_employees: number;
  };
}