import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { AuthenticatedRequest } from './auth';
import { logAuditEvent, AuditEventType } from './audit';
import { log } from "../../shared/utils/logger.js";

// Privacy consent types
export enum ConsentType {
  GPS_TRACKING = 'gps_tracking',
  DATA_ANALYTICS = 'data_analytics',
  DATA_EXPORT = 'data_export',
  PERFORMANCE_MONITORING = 'performance_monitoring'
}

// Data retention policies
export enum RetentionPolicy {
  DAYS_30 = 30,
  DAYS_90 = 90,
  DAYS_180 = 180,
  DAYS_365 = 365,
  INDEFINITE = -1
}

// Privacy settings interface
interface PrivacySettings {
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

// Data anonymization interface
interface AnonymizationRule {
  id: string;
  tableName: string;
  columnName: string;
  anonymizationType: 'hash' | 'remove' | 'replace';
  replacementValue?: string;
  isActive: boolean;
}

// Initialize privacy management
export const initializePrivacyManagement = () => {
  try {
    storage.exec(`
      CREATE TABLE IF NOT EXISTS privacy_settings (
        employee_id TEXT PRIMARY KEY,
        gps_tracking_consent BOOLEAN DEFAULT 0,
        data_analytics_consent BOOLEAN DEFAULT 0,
        data_export_consent BOOLEAN DEFAULT 0,
        performance_monitoring_consent BOOLEAN DEFAULT 0,
        data_retention_days INTEGER DEFAULT 90,
        anonymize_after_days INTEGER,
        consent_date TEXT,
        last_updated TEXT DEFAULT (datetime('now')),
        ip_address TEXT,
        consent_version TEXT DEFAULT '1.0'
      )
    `);

    storage.exec(`
      CREATE TABLE IF NOT EXISTS data_anonymization_rules (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        anonymization_type TEXT NOT NULL,
        replacement_value TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    storage.exec(`
      CREATE TABLE IF NOT EXISTS data_processing_log (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        processing_type TEXT NOT NULL,
        data_types TEXT,
        purpose TEXT,
        legal_basis TEXT,
        processed_at TEXT DEFAULT (datetime('now')),
        processed_by TEXT
      )
    `);

    insertDefaultAnonymizationRules();

    log.dev('Privacy management system initialized');
  } catch (error) {
    console.error('Failed to initialize privacy management:', error);
  }
};

// Insert default anonymization rules
const insertDefaultAnonymizationRules = () => {
  const defaultRules: Omit<AnonymizationRule, 'id'>[] = [
    {
      tableName: 'route_tracking',
      columnName: 'employee_id',
      anonymizationType: 'hash',
      isActive: true
    },
    {
      tableName: 'route_tracking',
      columnName: 'latitude',
      anonymizationType: 'remove',
      isActive: false
    },
    {
      tableName: 'route_tracking',
      columnName: 'longitude',
      anonymizationType: 'remove',
      isActive: false
    }
  ];

  defaultRules.forEach(rule => {
    const ruleId = 'rule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    try {
      storage.prepare(`
        INSERT OR IGNORE INTO data_anonymization_rules 
        (id, table_name, column_name, anonymization_type, replacement_value, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        ruleId,
        rule.tableName,
        rule.columnName,
        rule.anonymizationType,
        rule.replacementValue || null,
        rule.isActive ? 1 : 0
      );
    } catch (error) {
      // Ignore duplicate rules
    }
  });
}

// Export functions for routes
export const getPrivacySettings = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;

    const settings = storage.prepare(`
      SELECT * FROM privacy_settings WHERE employee_id = ?
    `).get(employeeId) as PrivacySettings | undefined;

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Privacy settings not found'
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get privacy settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updatePrivacySettings = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const updates = req.body;

    storage.prepare(`
      UPDATE privacy_settings 
      SET gps_tracking_consent = ?, data_analytics_consent = ?, 
          data_export_consent = ?, performance_monitoring_consent = ?,
          data_retention_days = ?, updated_at = datetime('now')
      WHERE employee_id = ?
    `).run(
      updates.gpsTrackingConsent,
      updates.dataAnalyticsConsent,
      updates.dataExportConsent,
      updates.performanceMonitoringConsent,
      updates.dataRetentionDays,
      employeeId
    );

    res.json({
      success: true,
      message: 'Privacy settings updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getDataProcessingSummary = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;

    const summary = storage.prepare(`
      SELECT 
        COUNT(*) as total_records,
        MIN(timestamp) as earliest_record,
        MAX(timestamp) as latest_record
      FROM route_tracking 
      WHERE employee_id = ?
    `).get(employeeId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get data processing summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const applyDataRetention = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { retentionDays } = req.body;

    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const result = storage.prepare(`
      DELETE FROM route_tracking 
      WHERE employee_id = ? AND timestamp < ?
    `).run(employeeId, cutoffDate);

    res.json({
      success: true,
      message: `Deleted ${result.changes} old records`,
      deletedRecords: result.changes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to apply data retention',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const anonymizeData = (data: any[], tableName: string) => {
  // Simple anonymization - replace sensitive fields
  return data.map(record => {
    const anonymized = { ...record };

    // Anonymize based on table
    if (tableName === 'route_tracking') {
      if (anonymized.employee_id) {
        anonymized.employee_id = `anon_${anonymized.employee_id.slice(-4)}`;
      }
      if (anonymized.latitude) {
        anonymized.latitude = Math.round(anonymized.latitude * 100) / 100; // Reduce precision
      }
      if (anonymized.longitude) {
        anonymized.longitude = Math.round(anonymized.longitude * 100) / 100; // Reduce precision
      }
    }

    return anonymized;
  });
};