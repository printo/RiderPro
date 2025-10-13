import { PrivacySettings, ConsentType, AuditLogEntry, AuditLogFilters, AuditStatistics } from '../types/Auth';
import { apiClient } from './ApiClient';

interface DataProcessingSummary {
  employeeId: string;
  dataProcessing: {
    total_records: number;
    earliest_record: string;
    latest_record: string;
    days_tracked: number;
  };
  privacySettings: PrivacySettings | null;
  dataTypes: string[];
  legalBasis: string;
  retentionPeriod: number;
}

class PrivacyService {
  private static instance: PrivacyService;

  private constructor() { }

  public static getInstance(): PrivacyService {
    if (!PrivacyService.instance) {
      PrivacyService.instance = new PrivacyService();
    }
    return PrivacyService.instance;
  }

  // Privacy Settings Management
  public async getPrivacySettings(employeeId: string): Promise<{ success: boolean; settings?: PrivacySettings; message?: string }> {
    try {
      const response = await apiClient.get(`/api/privacy/settings/${employeeId}`);
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          settings: data.data.settings
        };
      } else {
        return {
          success: false,
          message: data.message
        };
      }
    } catch (error) {
      console.error('Failed to get privacy settings:', error);
      return {
        success: false,
        message: 'Failed to retrieve privacy settings'
      };
    }
  }

  public async updatePrivacySettings(employeeId: string, settings: Partial<PrivacySettings>): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.put(`/api/privacy/settings/${employeeId}`, settings);

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      return {
        success: false,
        message: 'Failed to update privacy settings'
      };
    }
  }

  // Consent Management
  public async grantGPSConsent(employeeId: string, consent: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post(`/api/privacy/consent/gps/${employeeId}`, { consent });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to update GPS consent:', error);
      return {
        success: false,
        message: 'Failed to update GPS consent'
      };
    }
  }

  public async checkGPSConsent(employeeId: string): Promise<boolean> {
    try {
      const result = await this.getPrivacySettings(employeeId);
      return result.success && result.settings?.gpsTrackingConsent === true;
    } catch (error) {
      console.error('Failed to check GPS consent:', error);
      return false;
    }
  }

  // Data Processing and Export
  public async getDataProcessingSummary(employeeId: string): Promise<{ success: boolean; summary?: DataProcessingSummary; message?: string }> {
    try {
      const response = await apiClient.get(`/api/privacy/data-summary/${employeeId}`);
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          summary: data.data.summary
        };
      } else {
        return {
          success: false,
          message: data.message
        };
      }
    } catch (error) {
      console.error('Failed to get data processing summary:', error);
      return {
        success: false,
        message: 'Failed to retrieve data processing summary'
      };
    }
  }

  public async exportEmployeeData(employeeId: string, format: 'json' | 'csv' = 'json'): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.get(`/api/privacy/export/${employeeId}?format=${format}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `employee-${employeeId}-data.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        return {
          success: true,
          message: 'Data export completed successfully'
        };
      } else {
        const data = await response.json();
        return {
          success: false,
          message: data.message || 'Export failed'
        };
      }
    } catch (error) {
      console.error('Failed to export employee data:', error);
      return {
        success: false,
        message: 'Failed to export employee data'
      };
    }
  }

  public async deleteEmployeeData(employeeId: string, confirmDeletion: boolean = false): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete(`/api/privacy/data/${employeeId}`, { data: { confirmDeletion } });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to delete employee data:', error);
      return {
        success: false,
        message: 'Failed to delete employee data'
      };
    }
  }

  // Audit Logs (Admin/Manager only)
  public async getAuditLogs(filters: AuditLogFilters): Promise<{ success: boolean; logs?: AuditLogEntry[]; pagination?: any; message?: string }> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const response = await apiClient.get(`/api/privacy/audit-logs?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          logs: data.data.logs,
          pagination: data.data.pagination
        };
      } else {
        return {
          success: false,
          message: data.message
        };
      }
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return {
        success: false,
        message: 'Failed to retrieve audit logs'
      };
    }
  }

  public async getAuditStatistics(filters: { startDate?: string; endDate?: string; employeeId?: string }): Promise<{ success: boolean; stats?: AuditStatistics; message?: string }> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const response = await apiClient.get(`/api/privacy/audit-stats?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          stats: data.data.stats
        };
      } else {
        return {
          success: false,
          message: data.message
        };
      }
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      return {
        success: false,
        message: 'Failed to retrieve audit statistics'
      };
    }
  }

  // Data Retention and Cleanup (Admin only)
  public async applyDataRetention(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/api/privacy/data-retention');

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to apply data retention:', error);
      return {
        success: false,
        message: 'Failed to apply data retention policies'
      };
    }
  }

  public async cleanupAuditLogs(retentionDays: number = 90): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/api/privacy/cleanup-audit-logs', { retentionDays });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to cleanup audit logs:', error);
      return {
        success: false,
        message: 'Failed to cleanup audit logs'
      };
    }
  }

  // Anonymized Data Access
  public async getAnonymizedRouteData(filters: { startDate?: string; endDate?: string; limit?: number }): Promise<{ success: boolean; routes?: any[]; message?: string }> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      const response = await apiClient.get(`/api/privacy/anonymized-routes?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          routes: data.data.routes
        };
      } else {
        return {
          success: false,
          message: data.message
        };
      }
    } catch (error) {
      console.error('Failed to get anonymized route data:', error);
      return {
        success: false,
        message: 'Failed to retrieve anonymized route data'
      };
    }
  }

  // Utility methods
  public formatConsentDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return 'Invalid date';
    }
  }

  public getDataRetentionDescription(days: number): string {
    if (days === -1) return 'Indefinite';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  }

  public getConsentStatus(settings: PrivacySettings | null): {
    gps: 'granted' | 'denied' | 'unknown';
    analytics: 'granted' | 'denied' | 'unknown';
    export: 'granted' | 'denied' | 'unknown';
    monitoring: 'granted' | 'denied' | 'unknown';
  } {
    if (!settings) {
      return {
        gps: 'unknown',
        analytics: 'unknown',
        export: 'unknown',
        monitoring: 'unknown'
      };
    }

    return {
      gps: settings.gpsTrackingConsent ? 'granted' : 'denied',
      analytics: settings.dataAnalyticsConsent ? 'granted' : 'denied',
      export: settings.dataExportConsent ? 'granted' : 'denied',
      monitoring: settings.performanceMonitoringConsent ? 'granted' : 'denied'
    };
  }
}

// Export singleton instance
export const privacyService = PrivacyService.getInstance();
export default privacyService;