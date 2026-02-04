import { log } from "../utils/logger.js";
import config from '../config';
import { ErrorLog, ErrorRecoveryAction, ErrorHandlingConfig, ErrorStats } from '@shared/types';

export class ErrorHandlingService {
  private logs: ErrorLog[] = [];
  private config: ErrorHandlingConfig = {
    enableLogging: true,
    enableRemoteLogging: false,
    maxLocalLogs: 1000,
    logRetentionDays: 7,
    enableAutoRecovery: true,
    enableUserNotifications: true,
    criticalErrorThreshold: 5
  };
  private errorListeners: ((error: ErrorLog) => void)[] = [];
  private recoveryActions: Map<string, ErrorRecoveryAction[]> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor(config?: Partial<ErrorHandlingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.setupGlobalErrorHandlers();
    this.setupRecoveryActions();
    this.loadStoredLogs();
    this.startLogCleanup();
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError('system', 'Unhandled JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      }, event.error?.stack);
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('system', 'Unhandled promise rejection', {
        reason: event.reason,
        promise: event.promise
      });
    });

    // Handle network errors
    window.addEventListener('offline', () => {
      this.logWarn('network', 'Device went offline');
    });

    window.addEventListener('online', () => {
      this.logInfo('network', 'Device came back online');
    });
  }

  /**
   * Setup recovery actions for common error scenarios
   */
  private setupRecoveryActions(): void {
    // GPS permission denied recovery
    this.addRecoveryAction('gps_permission_denied', [
      {
        type: 'notify',
        description: 'Show permission request dialog',
        action: () => {
          // This would trigger a UI notification
          log.dev('GPS permission denied - showing user notification');
        }
      },
      {
        type: 'fallback',
        description: 'Continue without GPS tracking',
        action: () => {
          log.dev('Continuing shipment operations without GPS');
        }
      }
    ]);

    // GPS position unavailable recovery
    this.addRecoveryAction('gps_position_unavailable', [
      {
        type: 'retry',
        description: 'Retry GPS request with different settings',
        action: async () => {
          log.dev('Retrying GPS with fallback settings');
        }
      },
      {
        type: 'fallback',
        description: 'Use last known position',
        action: () => {
          log.dev('Using last known GPS position');
        }
      }
    ]);

    // Network error recovery
    this.addRecoveryAction('network_error', [
      {
        type: 'retry',
        description: 'Retry request after delay',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          log.dev('Retrying network request');
        }
      },
      {
        type: 'fallback',
        description: 'Store data offline',
        action: () => {
          log.dev('Storing data offline for later sync');
        }
      }
    ]);

    // Storage error recovery
    this.addRecoveryAction('storage_error', [
      {
        type: 'fallback',
        description: 'Use alternative storage method',
        action: () => {
          log.dev('Falling back to localStorage');
        }
      },
      {
        type: 'ignore',
        description: 'Continue without storing',
        action: () => {
          log.dev('Continuing without data storage');
        }
      }
    ]);
  }

  /**
   * Log an error
   */
  logError(
    category: ErrorLog['category'],
    message: string,
    details?: unknown,
    stack?: string,
    sessionId?: string
  ): string {
    return this.log('error', category, message, details, stack, sessionId);
  }

  /**
   * Log a warning
   */
  logWarn(
    category: ErrorLog['category'],
    message: string,
    details?: unknown,
    sessionId?: string
  ): string {
    return this.log('warn', category, message, details, undefined, sessionId);
  }

  /**
   * Log an info message
   */
  logInfo(
    category: ErrorLog['category'],
    message: string,
    details?: unknown,
    sessionId?: string
  ): string {
    return this.log('info', category, message, details, undefined, sessionId);
  }

  /**
   * Log a critical error
   */
  logCritical(
    category: ErrorLog['category'],
    message: string,
    details?: unknown,
    stack?: string,
    sessionId?: string
  ): string {
    const logId = this.log('critical', category, message, details, stack, sessionId);

    // Trigger immediate recovery actions for critical errors
    this.handleCriticalError(category, message, details);

    return logId;
  }

  /**
   * Core logging method
   */
  private log(
    level: ErrorLog['level'],
    category: ErrorLog['category'],
    message: string,
    details?: unknown,
    stack?: string,
    sessionId?: string
  ): string {
    if (!this.config.enableLogging) return '';

    const errorLog: ErrorLog = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      category,
      message,
      details,
      stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId,
      resolved: false
    };

    this.logs.push(errorLog);

    // Limit log storage
    if (this.logs.length > this.config.maxLocalLogs) {
      this.logs = this.logs.slice(-this.config.maxLocalLogs);
    }

    // Store logs locally
    this.storeLogs();

    // Send to remote logging service if enabled
    if (this.config.enableRemoteLogging) {
      this.sendToRemoteLogging(errorLog);
    }

    // Notify listeners
    this.notifyErrorListeners(errorLog);

    // Console logging for development
    const isDev = config.debug;
    if (isDev) {
      const consoleMethod = level === 'error' || level === 'critical' ? 'error' :
        level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}] ${category}: ${message}`, details);
    }

    // Track error counts
    const errorKey = `${category}_${message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Auto-recovery for known errors
    if (this.config.enableAutoRecovery) {
      this.attemptAutoRecovery(category, message, details);
    }

    return errorLog.id;
  }

  /**
   * Handle critical errors
   */
  private handleCriticalError(category: string, message: string, details?: unknown): void {
    console.error('CRITICAL ERROR:', { category, message, details });

    // Check if we've hit the critical error threshold
    const errorKey = `${category}_${message}`;
    const count = this.errorCounts.get(errorKey) || 0;

    if (count >= this.config.criticalErrorThreshold) {
      console.error('Critical error threshold reached - system may be unstable');

      // In a real application, this might trigger:
      // - Automatic error reporting
      // - Graceful degradation
      // - User notification
      // - System restart/recovery
    }
  }

  /**
   * Attempt automatic error recovery
   */
  private attemptAutoRecovery(category: string, message: string, _details?: unknown): void {
    const errorKey = `${category}_${message.toLowerCase().replace(/\s+/g, '_')}`;
    const actions = this.recoveryActions.get(errorKey);

    if (!actions || actions.length === 0) {
      // Try category-level recovery actions
      const categoryActions = this.recoveryActions.get(category);
      if (categoryActions && categoryActions.length > 0) {
        this.executeRecoveryActions(categoryActions, category, message);
      }
      return;
    }

    this.executeRecoveryActions(actions, category, message);
  }

  /**
   * Execute recovery actions
   */
  private async executeRecoveryActions(
    actions: ErrorRecoveryAction[],
    category: string,
    message: string
  ): Promise<void> {
    for (const action of actions) {
      try {
        log.dev(`Executing recovery action: ${action.description}`);
        await action.action();

        this.logInfo('system', `Recovery action executed: ${action.description}`, {
          category,
          originalMessage: message,
          actionType: action.type
        });

        // If retry action succeeds, we can stop here
        if (action.type === 'retry') {
          break;
        }
      } catch (error) {
        this.logError('system', `Recovery action failed: ${action.description}`, {
          error,
          category,
          originalMessage: message
        });
      }
    }
  }

  /**
   * Add recovery action for specific error
   */
  addRecoveryAction(errorKey: string, actions: ErrorRecoveryAction[]): void {
    this.recoveryActions.set(errorKey, actions);
  }

  /**
   * Get error logs
   */
  getLogs(filters?: {
    level?: ErrorLog['level'];
    category?: ErrorLog['category'];
    since?: Date;
    resolved?: boolean;
  }): ErrorLog[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filters.level);
      }
      if (filters.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filters.category);
      }
      if (filters.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.since!);
      }
      if (filters.resolved !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.resolved === filters.resolved);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const stats: ErrorStats = {
      total: this.logs.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      recentErrors: 0,
      resolvedErrors: 0,
      criticalErrors: 0
    };

    const oneHourAgo = new Date(Date.now() - 3600000);

    this.logs.forEach(log => {
      // Count by level
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

      // Count by category
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;

      // Count recent errors
      if (log.timestamp >= oneHourAgo) {
        stats.recentErrors++;
      }

      // Count resolved errors
      if (log.resolved) {
        stats.resolvedErrors++;
      }

      // Count critical errors
      if (log.level === 'critical') {
        stats.criticalErrors++;
      }
    });

    return stats;
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string): boolean {
    const error = this.logs.find(log => log.id === errorId);
    if (error) {
      error.resolved = true;
      this.storeLogs();
      return true;
    }
    return false;
  }

  /**
   * Clear old logs
   */
  clearOldLogs(): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.logRetentionDays);

    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);

    const removedCount = initialCount - this.logs.length;
    if (removedCount > 0) {
      this.storeLogs();
    }

    return removedCount;
  }

  /**
   * Add error listener
   */
  addErrorListener(listener: (error: ErrorLog) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove error listener
   */
  removeErrorListener(listener: (error: ErrorLog) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Notify error listeners
   */
  private notifyErrorListeners(error: ErrorLog): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Store logs to localStorage
   */
  private storeLogs(): void {
    try {
      localStorage.setItem('route_tracking_error_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.warn('Failed to store error logs:', error);
    }
  }

  /**
   * Load stored logs from localStorage
   */
  private loadStoredLogs(): void {
    try {
      const stored = localStorage.getItem('route_tracking_error_logs');
      if (stored) {
        const logs = JSON.parse(stored) as (Omit<ErrorLog, 'timestamp'> & { timestamp: string })[];
        this.logs = logs.map((log) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load stored error logs:', error);
    }
  }

  /**
   * Send error to remote logging service
   * Note: Error logging endpoint removed - errors are only logged locally
   */
  private async sendToRemoteLogging(error: ErrorLog): Promise<void> {
    // Error logging endpoint removed - errors are only logged to console
    console.error('Error logged locally:', error);
  }

  /**
   * Start periodic log cleanup
   */
  private startLogCleanup(): void {
    // Clean up old logs every hour
    setInterval(() => {
      const removed = this.clearOldLogs();
      if (removed > 0) {
        log.dev(`Cleaned up ${removed} old error logs`);
      }
    }, 3600000);
  }

  /**
   * Export error logs for analysis
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    recentErrors: number;
    criticalErrors: number;
    recommendations: string[];
  } {
    const stats = this.getErrorStats();
    const recommendations: string[] = [];

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = 'System is operating normally';

    if (stats.criticalErrors > 0) {
      status = 'critical';
      message = `${stats.criticalErrors} critical errors detected`;
      recommendations.push('Review critical errors immediately');
    } else if (stats.recentErrors > 10) {
      status = 'warning';
      message = `${stats.recentErrors} errors in the last hour`;
      recommendations.push('Monitor error patterns');
    }

    if (stats.byCategory.gps > stats.total * 0.3) {
      recommendations.push('GPS errors are frequent - check device permissions and signal');
    }

    if (stats.byCategory.network > stats.total * 0.2) {
      recommendations.push('Network errors detected - check connectivity');
    }

    return {
      status,
      message,
      recentErrors: stats.recentErrors,
      criticalErrors: stats.criticalErrors,
      recommendations
    };
  }
}