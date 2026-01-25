export interface QueryPerformanceMetric {
  queryType: string;
  duration: number;
  recordCount: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface DatabasePerformanceStats {
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number; // queries > 100ms
  failedQueries: number;
  totalRecords: number;
  indexHitRate: number;
  cacheHitRate: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'slow_query' | 'high_memory' | 'index_miss' | 'cache_miss' | 'storage_full';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceTrends {
  queryTrend: 'improving' | 'stable' | 'degrading';
  errorTrend: 'improving' | 'stable' | 'degrading';
  averageQueryTime: number[];
  errorRate: number[];
}

export class PerformanceMonitoringService {
  private metrics: QueryPerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private maxMetricsHistory = 1000;
  private slowQueryThreshold = 100; // ms
  private criticalQueryThreshold = 1000; // ms
  private listeners: ((stats: DatabasePerformanceStats) => void)[] = [];
  private alertListeners: ((alert: PerformanceAlert) => void)[] = [];

  constructor() {
    this.startPerformanceMonitoring();
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor performance every 30 seconds
    setInterval(() => {
      this.analyzePerformance();
      this.cleanupOldMetrics();
    }, 30000);

    // Monitor storage usage every 5 minutes
    setInterval(() => {
      this.checkStorageUsage();
    }, 300000);
  }

  /**
   * Record a database query performance metric
   */
  recordQuery(
    queryType: string,
    startTime: number,
    recordCount: number = 0,
    success: boolean = true,
    error?: string
  ): void {
    const duration = performance.now() - startTime;

    const metric: QueryPerformanceMetric = {
      queryType,
      duration,
      recordCount,
      timestamp: new Date(),
      success,
      error
    };

    this.metrics.push(metric);

    // Check for slow queries
    if (duration > this.slowQueryThreshold) {
      this.createAlert(
        'slow_query',
        duration > this.criticalQueryThreshold ? 'critical' : 'high',
        `Slow ${queryType} query: ${duration.toFixed(2)}ms (${recordCount} records)`
      );
    }

    // Limit metrics history
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Record IndexedDB operation performance
   */
  recordIndexedDBOperation(
    operation: string,
    storeName: string,
    startTime: number,
    recordCount: number = 0,
    success: boolean = true,
    error?: string
  ): void {
    this.recordQuery(`IndexedDB:${operation}:${storeName}`, startTime, recordCount, success, error);
  }

  /**
   * Record API call performance
   */
  recordAPICall(
    endpoint: string,
    method: string,
    startTime: number,
    responseSize: number = 0,
    success: boolean = true,
    error?: string
  ): void {
    this.recordQuery(`API:${method}:${endpoint}`, startTime, responseSize, success, error);
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): DatabasePerformanceStats {
    const recentMetrics = this.metrics.filter(m =>
      Date.now() - m.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const totalQueries = recentMetrics.length;
    const averageQueryTime = totalQueries > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries
      : 0;

    const slowQueries = recentMetrics.filter(m => m.duration > this.slowQueryThreshold).length;
    const failedQueries = recentMetrics.filter(m => !m.success).length;
    const totalRecords = recentMetrics.reduce((sum, m) => sum + m.recordCount, 0);

    // Estimate index hit rate (simplified)
    const indexedQueries = recentMetrics.filter(m =>
      m.queryType.includes('get') || m.queryType.includes('index')
    );
    const indexHitRate = indexedQueries.length > 0
      ? (indexedQueries.filter(m => m.duration < 50).length / indexedQueries.length) * 100
      : 100;

    // Estimate cache hit rate (simplified)
    const cacheableQueries = recentMetrics.filter(m =>
      m.queryType.includes('get') && m.recordCount > 0
    );
    const cacheHitRate = cacheableQueries.length > 0
      ? (cacheableQueries.filter(m => m.duration < 20).length / cacheableQueries.length) * 100
      : 100;

    return {
      totalQueries,
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      slowQueries,
      failedQueries,
      totalRecords,
      indexHitRate: Math.round(indexHitRate * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100
    };
  }

  /**
   * Analyze performance and create alerts
   */
  private analyzePerformance(): void {
    const stats = this.getPerformanceStats();

    // Check for performance issues
    if (stats.averageQueryTime > 200) {
      this.createAlert(
        'slow_query',
        'high',
        `Average query time is high: ${stats.averageQueryTime}ms`
      );
    }

    if (stats.failedQueries > stats.totalQueries * 0.1) {
      this.createAlert(
        'index_miss',
        'medium',
        `High query failure rate: ${stats.failedQueries}/${stats.totalQueries} queries failed`
      );
    }

    if (stats.indexHitRate < 80) {
      this.createAlert(
        'index_miss',
        'medium',
        `Low index hit rate: ${stats.indexHitRate}% - consider adding database indexes`
      );
    }

    // Check memory usage
    if ('memory' in performance) {
      type PerformanceWithMemory = Performance & {
        memory: {
          usedJSHeapSize: number;
          jsHeapSizeLimit: number;
          totalJSHeapSize: number;
        };
      };
      const memory = (performance as PerformanceWithMemory).memory;
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);

      if (usedMB > limitMB * 0.8) {
        this.createAlert(
          'high_memory',
          'high',
          `High memory usage: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB`
        );
      }
    }
  }

  /**
   * Check storage usage
   */
  private async checkStorageUsage(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage || 0) / (1024 * 1024);
        const quotaMB = (estimate.quota || 0) / (1024 * 1024);

        if (estimate.usage && estimate.quota) {
          const usagePercent = (estimate.usage / estimate.quota) * 100;

          if (usagePercent > 80) {
            this.createAlert(
              'storage_full',
              usagePercent > 95 ? 'critical' : 'high',
              `Storage usage is high: ${usedMB.toFixed(1)}MB / ${quotaMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`
            );
          }
        }
      }
    } catch (error) {
      console.warn('Failed to check storage usage:', error);
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string
  ): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(a =>
      a.type === type &&
      a.severity === severity &&
      !a.resolved &&
      Date.now() - a.timestamp.getTime() < 300000 // Within last 5 minutes
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: PerformanceAlert = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);

    // Notify alert listeners
    this.alertListeners.forEach(listener => {
      try {
        listener(alert);
      } catch (error) {
        console.error('Error in alert listener:', error);
      }
    });

    console.warn(`Performance Alert [${severity}]:`, message);
  }

  /**
   * Get all alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get unresolved alerts
   */
  getUnresolvedAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAge: number = 3600000): void {
    const cutoff = Date.now() - maxAge;
    this.alerts = this.alerts.filter(a =>
      a.timestamp.getTime() > cutoff || !a.resolved
    );
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - 3600000; // Keep last hour
    this.metrics = this.metrics.filter(m =>
      m.timestamp.getTime() > cutoff
    );
  }

  /**
   * Get query performance by type
   */
  getQueryPerformanceByType(): Record<string, {
    count: number;
    averageDuration: number;
    successRate: number;
  }> {
    const byType: Record<string, QueryPerformanceMetric[]> = {};

    this.metrics.forEach(metric => {
      if (!byType[metric.queryType]) {
        byType[metric.queryType] = [];
      }
      byType[metric.queryType].push(metric);
    });

    type QueryTypePerformance = {
      count: number;
      averageDuration: number;
      successRate: number;
    };
    const result: Record<string, QueryTypePerformance> = {};

    Object.entries(byType).forEach(([type, metrics]) => {
      const count = metrics.length;
      const averageDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / count;
      const successCount = metrics.filter(m => m.success).length;
      const successRate = (successCount / count) * 100;

      result[type] = {
        count,
        averageDuration: Math.round(averageDuration * 100) / 100,
        successRate: Math.round(successRate * 100) / 100
      };
    });

    return result;
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(timeWindow: number = 3600000): PerformanceTrends {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);

    // Split into time buckets (10 buckets)
    const bucketSize = timeWindow / 10;
    const buckets: QueryPerformanceMetric[][] = Array(10).fill(null).map(() => []);

    recentMetrics.forEach(metric => {
      const bucketIndex = Math.floor((metric.timestamp.getTime() - cutoff) / bucketSize);
      if (bucketIndex >= 0 && bucketIndex < 10) {
        buckets[bucketIndex].push(metric);
      }
    });

    const averageQueryTime = buckets.map(bucket => {
      if (bucket.length === 0) return 0;
      return bucket.reduce((sum, m) => sum + m.duration, 0) / bucket.length;
    });

    const errorRate = buckets.map(bucket => {
      if (bucket.length === 0) return 0;
      const errors = bucket.filter(m => !m.success).length;
      return (errors / bucket.length) * 100;
    });

    // Determine trends
    const queryTrend = this.calculateTrend(averageQueryTime);
    const errorTrend = this.calculateTrend(errorRate);

    return {
      queryTrend,
      errorTrend,
      averageQueryTime,
      errorRate
    };
  }

  /**
   * Calculate trend from data points
   */
  private calculateTrend(data: number[]): 'improving' | 'stable' | 'degrading' {
    if (data.length < 3) return 'stable';

    const recent = data.slice(-3);
    const earlier = data.slice(0, 3);

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;

    const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;

    if (change > 10) return 'degrading';
    if (change < -10) return 'improving';
    return 'stable';
  }

  /**
   * Add performance listener
   */
  addPerformanceListener(listener: (stats: DatabasePerformanceStats) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove performance listener
   */
  removePerformanceListener(listener: (stats: DatabasePerformanceStats) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Add alert listener
   */
  addAlertListener(listener: (alert: PerformanceAlert) => void): void {
    this.alertListeners.push(listener);
  }

  /**
   * Remove alert listener
   */
  removeAlertListener(listener: (alert: PerformanceAlert) => void): void {
    const index = this.alertListeners.indexOf(listener);
    if (index > -1) {
      this.alertListeners.splice(index, 1);
    }
  }

  /**
   * Notify performance listeners
   */
  private notifyListeners(): void {
    const stats = this.getPerformanceStats();
    this.listeners.forEach(listener => {
      try {
        listener(stats);
      } catch (error) {
        console.error('Error in performance listener:', error);
      }
    });
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const stats = this.getPerformanceStats();
    const recommendations: string[] = [];

    if (stats.averageQueryTime > 100) {
      recommendations.push('Consider adding database indexes for frequently queried fields');
    }

    if (stats.slowQueries > stats.totalQueries * 0.2) {
      recommendations.push('High number of slow queries detected - review query patterns');
    }

    if (stats.indexHitRate < 80) {
      recommendations.push('Low index hit rate - add indexes for commonly filtered fields');
    }

    if (stats.failedQueries > 0) {
      recommendations.push('Query failures detected - check data validation and error handling');
    }

    const unresolved = this.getUnresolvedAlerts();
    if (unresolved.length > 0) {
      recommendations.push(`${unresolved.length} performance alerts need attention`);
    }

    return recommendations;
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): {
    metrics: QueryPerformanceMetric[];
    stats: DatabasePerformanceStats;
    alerts: PerformanceAlert[];
    trends: PerformanceTrends;
  } {
    return {
      metrics: [...this.metrics],
      stats: this.getPerformanceStats(),
      alerts: [...this.alerts],
      trends: this.getPerformanceTrends()
    };
  }
}