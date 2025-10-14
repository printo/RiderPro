import { routeAPI } from '@/apiClient/routes';

export interface RetentionPolicy {
  routeDataDays: number;
  coordinateDataDays: number;
  analyticsDataDays: number;
  enableAutoCleanup: boolean;
  cleanupSchedule: 'daily' | 'weekly' | 'monthly';
}

export interface CleanupResult {
  success: boolean;
  deletedRecords: {
    routeTracking: number;
    analytics: number;
    sessions: number;
  };
  error?: string;
  executionTime: number;
}

export interface RetentionStats {
  totalRecords: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  recordsByAge: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
    older: number;
  };
  estimatedCleanupSize: number;
}

export class DataRetentionService {
  private static instance: DataRetentionService;
  private retentionPolicy: RetentionPolicy;
  private cleanupInProgress = false;

  private constructor() {
    this.retentionPolicy = this.getDefaultPolicy();
  }

  static getInstance(): DataRetentionService {
    if (!DataRetentionService.instance) {
      DataRetentionService.instance = new DataRetentionService();
    }
    return DataRetentionService.instance;
  }

  /**
   * Get default retention policy
   */
  private getDefaultPolicy(): RetentionPolicy {
    return {
      routeDataDays: 90,
      coordinateDataDays: 30,
      analyticsDataDays: 365,
      enableAutoCleanup: true,
      cleanupSchedule: 'weekly'
    };
  }

  /**
   * Update retention policy
   */
  updateRetentionPolicy(policy: Partial<RetentionPolicy>): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };
    this.saveRetentionPolicy();
  }

  /**
   * Get current retention policy
   */
  getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }

  /**
   * Save retention policy to localStorage
   */
  private saveRetentionPolicy(): void {
    try {
      localStorage.setItem('routeTrackingRetentionPolicy', JSON.stringify(this.retentionPolicy));
    } catch (error) {
      console.warn('Failed to save retention policy:', error);
    }
  }

  /**
   * Load retention policy from localStorage
   */
  loadRetentionPolicy(): void {
    try {
      const saved = localStorage.getItem('routeTrackingRetentionPolicy');
      if (saved) {
        this.retentionPolicy = { ...this.getDefaultPolicy(), ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load retention policy, using defaults:', error);
      this.retentionPolicy = this.getDefaultPolicy();
    }
  }

  /**
   * Get retention statistics
   */
  async getRetentionStats(): Promise<RetentionStats> {
    try {
      // This would typically call a backend API to get statistics
      // For now, we'll simulate the data structure
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // In a real implementation, this would fetch actual data from the API
      const mockStats: RetentionStats = {
        totalRecords: 15420,
        oldestRecord: '2024-01-15',
        newestRecord: now.toISOString().split('T')[0],
        recordsByAge: {
          last7Days: 1250,
          last30Days: 4800,
          last90Days: 12300,
          older: 3120
        },
        estimatedCleanupSize: 3120
      };

      return mockStats;
    } catch (error) {
      console.error('Failed to get retention stats:', error);
      throw error;
    }
  }

  /**
   * Execute data cleanup based on retention policy
   */
  async executeCleanup(dryRun: boolean = false): Promise<CleanupResult> {
    if (this.cleanupInProgress) {
      throw new Error('Cleanup is already in progress');
    }

    this.cleanupInProgress = true;
    const startTime = Date.now();

    try {
      const cutoffDates = this.calculateCutoffDates();

      // In a real implementation, this would call backend APIs to delete old data
      // For now, we'll simulate the cleanup process
      const result: CleanupResult = {
        success: true,
        deletedRecords: {
          routeTracking: dryRun ? 0 : Math.floor(Math.random() * 1000),
          analytics: dryRun ? 0 : Math.floor(Math.random() * 500),
          sessions: dryRun ? 0 : Math.floor(Math.random() * 200)
        },
        executionTime: Date.now() - startTime
      };

      if (!dryRun) {
        console.log('Data cleanup completed:', result);
      }

      return result;

    } catch (error) {
      console.error('Data cleanup failed:', error);
      return {
        success: false,
        deletedRecords: {
          routeTracking: 0,
          analytics: 0,
          sessions: 0
        },
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * Calculate cutoff dates based on retention policy
   */
  private calculateCutoffDates(): {
    routeData: Date;
    coordinateData: Date;
    analyticsData: Date;
  } {
    const now = new Date();

    return {
      routeData: new Date(now.getTime() - this.retentionPolicy.routeDataDays * 24 * 60 * 60 * 1000),
      coordinateData: new Date(now.getTime() - this.retentionPolicy.coordinateDataDays * 24 * 60 * 60 * 1000),
      analyticsData: new Date(now.getTime() - this.retentionPolicy.analyticsDataDays * 24 * 60 * 60 * 1000)
    };
  }

  /**
   * Schedule automatic cleanup
   */
  scheduleAutoCleanup(): void {
    if (!this.retentionPolicy.enableAutoCleanup) {
      return;
    }

    // Clear any existing scheduled cleanup
    this.clearAutoCleanup();

    const scheduleCleanup = () => {
      this.executeCleanup(false).catch(error => {
        console.error('Scheduled cleanup failed:', error);
      });
    };

    let intervalMs: number;
    switch (this.retentionPolicy.cleanupSchedule) {
      case 'daily':
        intervalMs = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'weekly':
        intervalMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case 'monthly':
        intervalMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      default:
        intervalMs = 7 * 24 * 60 * 60 * 1000; // Default to weekly
    }

    // Store the interval ID for cleanup
    const intervalId = setInterval(scheduleCleanup, intervalMs);
    (window as any).__routeTrackingCleanupInterval = intervalId;

    console.log(`Auto cleanup scheduled: ${this.retentionPolicy.cleanupSchedule}`);
  }

  /**
   * Clear automatic cleanup schedule
   */
  clearAutoCleanup(): void {
    const intervalId = (window as any).__routeTrackingCleanupInterval;
    if (intervalId) {
      clearInterval(intervalId);
      delete (window as any).__routeTrackingCleanupInterval;
    }
  }

  /**
   * Export data before cleanup
   */
  async exportBeforeCleanup(): Promise<{
    success: boolean;
    filename?: string;
    error?: string;
  }> {
    try {
      // This would export data that's about to be cleaned up
      // Implementation would depend on the DataExporter service
      const cutoffDates = this.calculateCutoffDates();

      // For now, return a mock result
      return {
        success: true,
        filename: `route-data-backup-${new Date().toISOString().split('T')[0]}.json`
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Validate retention policy
   */
  validateRetentionPolicy(policy: Partial<RetentionPolicy>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (policy.routeDataDays !== undefined && policy.routeDataDays < 1) {
      errors.push('Route data retention must be at least 1 day');
    }

    if (policy.coordinateDataDays !== undefined && policy.coordinateDataDays < 1) {
      errors.push('Coordinate data retention must be at least 1 day');
    }

    if (policy.analyticsDataDays !== undefined && policy.analyticsDataDays < 1) {
      errors.push('Analytics data retention must be at least 1 day');
    }

    if (policy.routeDataDays && policy.coordinateDataDays &&
      policy.coordinateDataDays > policy.routeDataDays) {
      errors.push('Coordinate data retention cannot be longer than route data retention');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get cleanup recommendations
   */
  async getCleanupRecommendations(): Promise<{
    shouldCleanup: boolean;
    reasons: string[];
    estimatedSavings: {
      records: number;
      storageSize: string;
    };
  }> {
    try {
      const stats = await this.getRetentionStats();
      const reasons: string[] = [];
      let shouldCleanup = false;

      if (stats.recordsByAge.older > 1000) {
        shouldCleanup = true;
        reasons.push(`${stats.recordsByAge.older} records are older than retention policy`);
      }

      if (stats.totalRecords > 50000) {
        shouldCleanup = true;
        reasons.push('Large number of total records may impact performance');
      }

      const oldestDate = stats.oldestRecord ? new Date(stats.oldestRecord) : null;
      if (oldestDate) {
        const daysSinceOldest = Math.floor((Date.now() - oldestDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceOldest > this.retentionPolicy.routeDataDays * 2) {
          shouldCleanup = true;
          reasons.push('Some data is significantly older than retention policy');
        }
      }

      return {
        shouldCleanup,
        reasons,
        estimatedSavings: {
          records: stats.estimatedCleanupSize,
          storageSize: `${Math.round(stats.estimatedCleanupSize * 0.5 / 1024)} KB`
        }
      };
    } catch (error) {
      console.error('Failed to get cleanup recommendations:', error);
      return {
        shouldCleanup: false,
        reasons: ['Unable to analyze data for cleanup recommendations'],
        estimatedSavings: {
          records: 0,
          storageSize: '0 KB'
        }
      };
    }
  }
}