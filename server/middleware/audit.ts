import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { AuthenticatedRequest } from './auth';
import { log } from "../../shared/utils/logger.js";

// Audit event types
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
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

// Audit log entry interface
interface AuditLogEntry {
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

// Initialize audit logging
export const initializeAuditLogging = () => {
  try {
    // Create audit_logs table
    storage.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        username TEXT,
        employee_id TEXT,
        resource_type TEXT,
        resource_id TEXT,
        action TEXT NOT NULL,
        details TEXT, -- JSON string
        ip_address TEXT,
        user_agent TEXT,
        timestamp TEXT DEFAULT (datetime('now')),
        success BOOLEAN NOT NULL,
        error_message TEXT
      )
    `);

    // Create indexes for better query performance
    storage.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_employee_id ON audit_logs(employee_id);
    `);

    log.dev('Audit logging system initialized');
  } catch (error) {
    console.error('Failed to initialize audit logging:', error);
  }
};

// Log audit event
export const logAuditEvent = (entry: Partial<AuditLogEntry> & {
  eventType: AuditEventType;
  action: string;
  success: boolean;
}) => {
  try {
    const auditId = 'audit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const auditEntry: AuditLogEntry = {
      id: auditId,
      eventType: entry.eventType,
      userId: entry.userId,
      username: entry.username,
      employeeId: entry.employeeId,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      action: entry.action,
      details: entry.details || {},
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      timestamp: new Date().toISOString(),
      success: entry.success,
      errorMessage: entry.errorMessage
    };

    storage.prepare(`
      INSERT INTO audit_logs (
        id, event_type, user_id, username, employee_id, resource_type, resource_id,
        action, details, ip_address, user_agent, timestamp, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditEntry.id,
      auditEntry.eventType,
      auditEntry.userId,
      auditEntry.username,
      auditEntry.employeeId,
      auditEntry.resourceType,
      auditEntry.resourceId,
      auditEntry.action,
      JSON.stringify(auditEntry.details),
      auditEntry.ipAddress,
      auditEntry.userAgent,
      auditEntry.timestamp,
      auditEntry.success ? 1 : 0,
      auditEntry.errorMessage
    );

    // Log to console for development (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      log.dev('Audit Event:', {
        type: auditEntry.eventType,
        user: auditEntry.username,
        action: auditEntry.action,
        success: auditEntry.success
      });
    }
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

// Middleware to automatically log route data access
export const auditRouteDataAccess = (eventType: AuditEventType, resourceType: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (body: any) {
      // Log the audit event
      logAuditEvent({
        eventType,
        userId: req.user?.id,
        username: req.user?.username,
        employeeId: req.user?.employeeId,
        resourceType,
        resourceId: req.params.id || req.query.employeeId as string,
        action: `${req.method} ${req.path}`,
        details: {
          query: req.query,
          params: req.params,
          responseSize: JSON.stringify(body).length
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        success: res.statusCode < 400
      });

      return originalJson.call(this, body);
    };

    next();
  };
};

// Middleware to log authentication events
export const auditAuthEvent = (eventType: AuditEventType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function (body: any) {
      const success = res.statusCode < 400;

      logAuditEvent({
        eventType,
        username: req.body.username || req.body.email,
        action: `${req.method} ${req.path}`,
        details: {
          loginAttempt: req.body.username || req.body.email,
          success
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        success,
        errorMessage: success ? undefined : body.message
      });

      return originalJson.call(this, body);
    };

    next();
  };
};

// Get audit logs with filtering
export const getAuditLogs = (filters: {
  userId?: string;
  employeeId?: string;
  eventType?: AuditEventType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) => {
  try {
    let query = `
      SELECT 
        id, event_type, user_id, username, employee_id, resource_type, resource_id,
        action, details, ip_address, user_agent, timestamp, success, error_message
      FROM audit_logs
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.employeeId) {
      query += ' AND employee_id = ?';
      params.push(filters.employeeId);
    }

    if (filters.eventType) {
      query += ' AND event_type = ?';
      params.push(filters.eventType);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const logs = storage.prepare(query).all(...params) as any[];

    return logs.map(log => ({
      ...log,
      details: JSON.parse(log.details || '{}'),
      success: Boolean(log.success)
    }));
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
};

// Get audit statistics
export const getAuditStatistics = (filters: {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}) => {
  try {
    let query = `
      SELECT 
        event_type,
        COUNT(*) as count,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
      FROM audit_logs
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    if (filters.employeeId) {
      query += ' AND employee_id = ?';
      params.push(filters.employeeId);
    }

    query += ' GROUP BY event_type ORDER BY count DESC';

    const stats = storage.prepare(query).all(...params) as any[];

    // Get total counts
    const totalQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT employee_id) as unique_employees
      FROM audit_logs
      WHERE timestamp >= ? AND timestamp <= ?
    `;

    const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.endDate || new Date().toISOString();

    const totals = storage.prepare(totalQuery).get(startDate, endDate) as any;

    return {
      eventTypes: stats,
      totals
    };
  } catch (error) {
    console.error('Failed to get audit statistics:', error);
    return { eventTypes: [], totals: {} };
  }
};

// Clean up old audit logs (data retention)
export const cleanupOldAuditLogs = (retentionDays: number = 90) => {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const result = storage.prepare(`
      DELETE FROM audit_logs 
      WHERE timestamp < ?
    `).run(cutoffDate);

    if (result.changes > 0) {
      log.dev(`Cleaned up ${result.changes} old audit log entries`);

      // Log the cleanup action
      logAuditEvent({
        eventType: AuditEventType.DATA_RETENTION_APPLIED,
        action: 'cleanup_audit_logs',
        details: {
          deletedEntries: result.changes,
          retentionDays,
          cutoffDate
        },
        success: true
      });
    }
  } catch (error) {
    console.error('Failed to cleanup old audit logs:', error);
  }
};

// Export types
export type { AuditLogEntry };