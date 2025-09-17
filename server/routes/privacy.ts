import express, { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, Permission, authorizeEmployeeAccess, AuthenticatedRequest } from '../middleware/auth';
import {
  getPrivacySettings,
  updatePrivacySettings,
  getDataProcessingSummary,
  applyDataRetention,
  anonymizeData
} from '../middleware/privacy';
import {
  getAuditLogs,
  getAuditStatistics,
  logAuditEvent,
  AuditEventType,
  cleanupOldAuditLogs
} from '../middleware/audit';
import { storage } from '../storage';

const router = express.Router();

// Helper function to cast request to AuthenticatedRequest (no longer needed)
// const getAuthReq = (req: Request): AuthenticatedRequest => req as AuthenticatedRequest;

// ---------------- Privacy Settings ---------------- //

// Get privacy settings for an employee
router.get(
  '/settings/:employeeId',
  authenticate,
  authorizeEmployeeAccess,
  (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { employeeId } = req.params;
      return getPrivacySettings(authReq, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get privacy settings',
        code: 'GET_SETTINGS_FAILED'
      });
    }
  }
);

// Update privacy settings for an employee
router.put(
  '/settings/:employeeId',
  authenticate,
  authorizeEmployeeAccess,
  (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { employeeId } = req.params;
      const settings = req.body;

      return updatePrivacySettings(authReq, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings',
        code: 'UPDATE_SETTINGS_FAILED'
      });
    }
  }
);

// Grant consent for GPS tracking
router.post(
  '/consent/gps/:employeeId',
  authenticate,
  authorizeEmployeeAccess,
  (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { employeeId } = req.params;
      const { consent } = req.body;

      if (typeof consent !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Consent must be a boolean value',
          code: 'INVALID_CONSENT_VALUE'
        });
      }

      try {
        // Update GPS tracking consent in database
        const result = storage.prepare(`
          UPDATE privacy_settings 
          SET gps_tracking_consent = ?, updated_at = datetime('now')
          WHERE employee_id = ?
        `).run(consent, employeeId);

        if (result.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Employee privacy settings not found',
            code: 'PRIVACY_SETTINGS_NOT_FOUND'
          });
        }

        // Log the privacy change
        logAuditEvent({
          eventType: consent ? AuditEventType.CONSENT_GRANTED : AuditEventType.CONSENT_REVOKED,
          action: `GPS tracking consent ${consent ? 'granted' : 'revoked'}`,
          success: true,
          userId: authReq.user?.id,
          username: authReq.user?.username,
          employeeId,
          resourceType: 'privacy_settings',
          resourceId: employeeId,
          details: {
            gpsTrackingConsent: consent,
            ipAddress: req.ip
          }
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update GPS consent',
          code: 'CONSENT_UPDATE_FAILED'
        });
      }

      res.json({
        success: true,
        message: `GPS tracking consent ${consent ? 'granted' : 'revoked'} successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update GPS consent',
        code: 'CONSENT_UPDATE_FAILED'
      });
    }
  }
);

// ---------------- Data Processing ---------------- //

// Get data processing summary for an employee
router.get(
  '/data-summary/:employeeId',
  authenticate,
  authorizeEmployeeAccess,
  (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      return getDataProcessingSummary(authReq, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get data processing summary',
        code: 'GET_SUMMARY_FAILED'
      });
    }
  }
);

// Request data deletion for an employee
router.delete(
  '/data/:employeeId',
  authenticate,
  authorizeEmployeeAccess,
  (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { employeeId } = req.params;
      const { confirmDeletion } = req.body;

      if (!confirmDeletion) {
        return res.status(400).json({
          success: false,
          message: 'Data deletion must be explicitly confirmed',
          code: 'DELETION_NOT_CONFIRMED'
        });
      }

      const result = storage.prepare(
        `DELETE FROM route_tracking WHERE employee_id = ?`
      ).run(employeeId);

      logAuditEvent({
        eventType: AuditEventType.DATA_RETENTION_APPLIED,
        userId: authReq.user?.id,
        username: authReq.user?.username,
        employeeId,
        action: 'delete_employee_data',
        details: {
          recordsDeleted: result.changes,
          requestedBy: authReq.user?.username,
          reason: 'Employee data deletion request'
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });

      res.json({
        success: true,
        message: `Successfully deleted ${result.changes} records for employee ${employeeId}`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete employee data',
        code: 'DATA_DELETION_FAILED'
      });
    }
  }
);

// ---------------- Audit Logs ---------------- //

// Get audit logs (admin/manager only)
router.get(
  '/audit-logs',
  authenticate,
  authorize(Permission.ACCESS_AUDIT_LOGS),
  (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const {
        userId,
        employeeId,
        eventType,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      const logs = getAuditLogs({
        userId: userId as string,
        employeeId: employeeId as string,
        eventType: eventType as any,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      logAuditEvent({
        eventType: AuditEventType.ROUTE_DATA_VIEWED,
        userId: authReq.user?.id,
        username: authReq.user?.username,
        resourceType: 'audit_logs',
        action: 'view_audit_logs',
        details: {
          filters: req.query,
          resultCount: logs.length
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: logs.length === parseInt(limit as string)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get audit logs',
        code: 'GET_AUDIT_LOGS_FAILED'
      });
    }
  }
);

// Get audit statistics (admin/manager only)
router.get(
  '/audit-stats',
  authenticate,
  authorize(Permission.ACCESS_AUDIT_LOGS),
  (req: Request, res: Response) => {
    try {
      const { startDate, endDate, employeeId } = req.query;

      const stats = getAuditStatistics({
        startDate: startDate as string,
        endDate: endDate as string,
        employeeId: employeeId as string
      });

      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get audit statistics',
        code: 'GET_AUDIT_STATS_FAILED'
      });
    }
  }
);

// ---------------- Admin Actions ---------------- //

// Apply data retention policies (admin only)
router.post(
  '/data-retention',
  authenticate,
  authorize(Permission.CONFIGURE_SYSTEM),
  (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      applyDataRetention(authReq, res);

      res.json({
        success: true,
        message: 'Data retention policies applied successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to apply data retention policies',
        code: 'DATA_RETENTION_FAILED'
      });
    }
  }
);

// Clean up old audit logs (admin only)
router.post(
  '/cleanup-audit-logs',
  authenticate,
  authorize(Permission.CONFIGURE_SYSTEM),
  (req: Request, res: Response) => {
    try {
      const { retentionDays = 90 } = req.body;
      cleanupOldAuditLogs(retentionDays);

      res.json({
        success: true,
        message: 'Audit log cleanup completed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup audit logs',
        code: 'AUDIT_CLEANUP_FAILED'
      });
    }
  }
);

// ---------------- Analytics ---------------- //

// Get anonymized route data (for analytics without personal data)
router.get(
  '/anonymized-routes',
  authenticate,
  authorize(Permission.VIEW_ANALYTICS),
  (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { startDate, endDate, limit = 1000 } = req.query;

      let query = `SELECT * FROM route_tracking WHERE 1=1`;
      const params: any[] = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(parseInt(limit as string));

      const rawData = storage.prepare(query).all(...params) as any[];
      const anonymizedData = anonymizeData(rawData, 'route_tracking');

      logAuditEvent({
        eventType: AuditEventType.ANALYTICS_VIEWED,
        userId: authReq.user?.id,
        username: authReq.user?.username,
        resourceType: 'anonymized_routes',
        action: 'view_anonymized_route_data',
        details: {
          recordCount: anonymizedData.length,
          filters: req.query
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });

      res.json({
        success: true,
        data: {
          routes: anonymizedData,
          isAnonymized: true,
          recordCount: anonymizedData.length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get anonymized route data',
        code: 'GET_ANONYMIZED_DATA_FAILED'
      });
    }
  }
);

// ---------------- Data Export ---------------- //

// Export employee data (GDPR compliance)
router.get(
  '/export/:employeeId',
  authenticate,
  authorizeEmployeeAccess,
  (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { employeeId } = req.params;
      const { format = 'json' } = req.query;

      const routeData = storage.prepare(
        `SELECT * FROM route_tracking WHERE employee_id = ? ORDER BY timestamp DESC`
      ).all(employeeId);

      const privacySettings = getPrivacySettings(authReq, res);
      const dataSummary = getDataProcessingSummary(authReq, res);

      const exportData = {
        employeeId,
        exportDate: new Date().toISOString(),
        privacySettings,
        dataSummary,
        routeData,
        dataTypes: [
          'GPS coordinates',
          'Timestamps',
          'Route sessions',
          'Performance metrics'
        ],
        legalBasis: 'GDPR Article 20 - Right to data portability'
      };

      logAuditEvent({
        eventType: AuditEventType.ROUTE_DATA_EXPORTED,
        userId: authReq.user?.id,
        username: authReq.user?.username,
        employeeId,
        resourceType: 'employee_data_export',
        action: 'export_employee_data',
        details: {
          format,
          recordCount: routeData.length,
          requestedBy: authReq.user?.username
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });

      if (format === 'csv') {
        const csv = convertToCSV(routeData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="employee-${employeeId}-data.csv"`
        );
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="employee-${employeeId}-data.json"`
        );
        res.json(exportData);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to export employee data',
        code: 'DATA_EXPORT_FAILED'
      });
    }
  }
);

// ---------------- Helpers ---------------- //

// Convert array of objects to CSV string
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string'
        ? `"${value.replace(/"/g, '""')}"`
        : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export default router;