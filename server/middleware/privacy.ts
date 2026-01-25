import { Request, Response } from 'express';
import { pool } from '../db/connection';
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
export const initializePrivacyManagement = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS privacy_settings (
        employee_id TEXT PRIMARY KEY,
        gps_tracking_consent BOOLEAN DEFAULT FALSE,
        data_analytics_consent BOOLEAN DEFAULT FALSE,
        data_export_consent BOOLEAN DEFAULT FALSE,
        performance_monitoring_consent BOOLEAN DEFAULT FALSE,
        data_retention_days INTEGER DEFAULT 90,
        anonymize_after_days INTEGER,
        consent_date TIMESTAMP WITH TIME ZONE,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        consent_version TEXT DEFAULT '1.0'
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_anonymization_rules (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        anonymization_type TEXT NOT NULL,
        replacement_value TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_processing_log (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        processing_type TEXT NOT NULL,
        data_types TEXT,
        purpose TEXT,
        legal_basis TEXT,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_by TEXT
      )
    `);

    await insertDefaultAnonymizationRules();

    log.dev('Privacy management system initialized');
  } catch (error) {
    console.error('Failed to initialize privacy management:', error);
  }
};

// Insert default anonymization rules
const insertDefaultAnonymizationRules = async () => {
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

  for (const rule of defaultRules) {
    const ruleId = 'rule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    try {
      await pool.query(`
        INSERT INTO data_anonymization_rules 
        (id, table_name, column_name, anonymization_type, replacement_value, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `, [
        ruleId,
        rule.tableName,
        rule.columnName,
        rule.anonymizationType,
        rule.replacementValue || null,
        rule.isActive
      ]);
    } catch (_error) {
      // Ignore errors
    }
  }
}

// Export functions for routes
export const getPrivacySettings = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;

    const result = await pool.query(`
      SELECT * FROM privacy_settings WHERE employee_id = $1
    `, [employeeId]);

    const settings = result.rows[0] as PrivacySettings | undefined;

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

    await pool.query(`
      UPDATE privacy_settings 
      SET gps_tracking_consent = $1, data_analytics_consent = $2, 
          data_export_consent = $3, performance_monitoring_consent = $4,
          data_retention_days = $5, updated_at = NOW()
      WHERE employee_id = $6
    `, [
      updates.gpsTrackingConsent,
      updates.dataAnalyticsConsent,
      updates.dataExportConsent,
      updates.performanceMonitoringConsent,
      updates.dataRetentionDays,
      employeeId
    ]);

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

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(timestamp) as earliest_record,
        MAX(timestamp) as latest_record
      FROM route_tracking 
      WHERE employee_id = $1
    `, [employeeId]);
    
    const summary = result.rows[0];

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

    const result = await pool.query(`
      DELETE FROM route_tracking 
      WHERE employee_id = $1 AND timestamp < $2
    `, [employeeId, cutoffDate]);

    res.json({
      success: true,
      message: `Deleted ${result.rowCount} old records`,
      deletedRecords: result.rowCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to apply data retention',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const anonymizeData = (
  data: Record<string, unknown>[],
  tableName: string
): Record<string, unknown>[] => {
  return data.map(original => {
    const anonymized: Record<string, unknown> = { ...original };

    if (tableName === 'route_tracking') {
      const empId = anonymized['employee_id'] as string | undefined;
      if (typeof empId === 'string') {
        anonymized['employee_id'] = `anon_${empId.slice(-4)}`;
      }

      const lat = anonymized['latitude'] as number | undefined;
      if (typeof lat === 'number') {
        anonymized['latitude'] = Math.round(lat * 100) / 100;
      }

      const lon = anonymized['longitude'] as number | undefined;
      if (typeof lon === 'number') {
        anonymized['longitude'] = Math.round(lon * 100) / 100;
      }
    }

    return anonymized;
  });
};