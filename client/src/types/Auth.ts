// Auth types
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
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
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
  details?: Record<string, any>;
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
