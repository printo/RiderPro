import { Database } from 'better-sqlite3';
import os from 'os';
import fs from 'fs';
import config, { MonitoringConfig } from '../config';
import { log } from "../../shared/utils/logger.js";

// Health check status
export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

// Comprehensive system metrics interface
export interface SystemMetrics {
  timestamp: string;
  system: {
    uptime: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
      heap: {
        used: number;
        total: number;
      };
    };
    cpuUsage: number;
    loadAverage: number[];
    diskUsage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  database: {
    size: number;
    queryTime: number;
    connectionCount: number;
    indexEfficiency: number;
  };
  application: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  routeTracking?: {
    activeSessions: number;
    gpsCoordinatesCount: number;
    averageAccuracy: number;
  };
}

// Individual metric interface
export interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: HealthStatus;
  threshold?: number;
  timestamp: string;
  details?: Record<string, any>;
}

// Health check result
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  metrics: SystemMetric[];
  services: {
    database: HealthStatus;
    routeTracking: HealthStatus;
    authentication: HealthStatus;
    fileSystem: HealthStatus;
  };
  alerts: Alert[];
}

// Alert interface
export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  metadata?: Record<string, any>;
}

// Performance thresholds
export interface PerformanceThresholds {
  maxQueryTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  maxDatabaseSize: number; // MB
  minIndexEfficiency: number; // percentage
  maxErrorRate: number; // percentage
  maxResponseTime: number; // milliseconds
}

class SystemMonitoringService {
  private static instance: SystemMonitoringService;
  private db: Database;
  private config: MonitoringConfig;
  private thresholds: PerformanceThresholds;
  private alerts: Map<string, Alert> = new Map();
  private metrics: SystemMetrics[] = [];
  private maxMetricsHistory = 100;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: number = Date.now();

  // Application metrics
  private requestCount: number = 0;
  private totalResponseTime: number = 0;
  private errorCount: number = 0;

  private constructor(database: Database, monitoringConfig: MonitoringConfig) {
    this.db = database;
    this.config = monitoringConfig;
    this.thresholds = {
      maxQueryTime: monitoringConfig.thresholds.responseTime || 1000,
      maxMemoryUsage: 200, // MB
      maxDatabaseSize: monitoringConfig.thresholds.databaseSize || 1000,
      minIndexEfficiency: 80, // percentage
      maxErrorRate: monitoringConfig.thresholds.errorRate || 5,
      maxResponseTime: monitoringConfig.thresholds.responseTime || 1000
    };
    this.initializeMonitoring();
  }

  public static getInstance(
    database?: Database,
    monitoringConfig?: MonitoringConfig
  ): SystemMonitoringService {
    if (!SystemMonitoringService.instance) {
      if (!database || !monitoringConfig) {
        throw new Error(
          'Database and monitoring config required for first initialization'
        );
      }
      SystemMonitoringService.instance = new SystemMonitoringService(database, monitoringConfig);
    }
    return SystemMonitoringService.instance;
  }

  private initializeMonitoring(): void {
    if (!this.config.enabled) {
      log.dev('📊 Monitoring disabled');
      return;
    }

    log.dev('📊 Initializing system monitoring service...');

    // Initialize database tables for metrics storage
    this.initializeMetricsTables();

    // Start health check interval
    this.startHealthChecks();

    log.dev('✓ System monitoring service initialized');
  }

  private initializeMetricsTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS system_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          metric_value REAL NOT NULL,
          metric_unit TEXT,
          status TEXT,
          threshold_value REAL,
          details TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp 
          ON system_metrics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_system_metrics_name 
          ON system_metrics(metric_name);

        CREATE TABLE IF NOT EXISTS system_alerts (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          resolved BOOLEAN DEFAULT 0,
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_system_alerts_timestamp 
          ON system_alerts(timestamp);
        CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved 
          ON system_alerts(resolved);
      `);
    } catch (error) {
      console.error('Failed to initialize metrics tables:', error);
    }
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('Health check failed:', error);
      });
    }, this.config.healthCheckInterval * 1000);

    // Perform initial health check
    this.performHealthCheck().catch(error => {
      console.error('Initial health check failed:', error);
    });
  }

  public async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date().toISOString();

    // System metrics
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Database metrics
    const databaseMetrics = await this.collectDatabaseMetrics();

    // Application metrics
    const applicationMetrics = {
      requestCount: this.requestCount,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      activeConnections: 0 // Would be tracked by connection pool
    };

    // Route tracking metrics (if enabled)
    let routeTrackingMetrics;
    if (config.routeTracking.enabled && config.featureFlags.routeTracking) {
      routeTrackingMetrics = await this.collectRouteTrackingMetrics();
    }

    // Disk usage
    const diskUsage = await this.getDiskUsage();

    const metrics: SystemMetrics = {
      timestamp,
      system: {
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        memoryUsage: {
          used: Math.round(usedMemory / 1024 / 1024),
          total: Math.round(totalMemory / 1024 / 1024),
          percentage: (usedMemory / totalMemory) * 100,
          heap: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
          }
        },
        cpuUsage: (os.loadavg()[0] * 100) / os.cpus().length,
        loadAverage: os.loadavg(),
        diskUsage
      },
      database: databaseMetrics,
      application: applicationMetrics,
      routeTracking: routeTrackingMetrics
    };

    // Store metrics (keep only recent history)
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Store in database
    this.storeMetrics(metrics);

    return metrics;
  }

  private async collectDatabaseMetrics(): Promise<SystemMetrics['database']> {
    // Measure query time with a representative query
    const queryStartTime = Date.now();
    try {
      this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM shipments 
        WHERE created_at >= date('now', '-7 days')
      `).get();
    } catch (error) {
      // If shipments table doesn't exist or query fails, use a simple query
      this.db.prepare('SELECT 1').get();
    }
    const queryTime = Date.now() - queryStartTime;

    // Get database size
    let databaseSize = 0;
    try {
      if (config.database.path !== ':memory:') {
        const stats = fs.statSync(config.database.path);
        databaseSize = Math.round(stats.size / 1024 / 1024); // MB
      }
    } catch (error) {
      // Fallback if file doesn't exist
      databaseSize = 0;
    }

    // Calculate index efficiency
    let indexEfficiency = 100;
    try {
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as any[];

      const indexes = this.db.prepare(`
        SELECT tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all() as any[];

      const indexedTables = new Set(indexes.map(idx => idx.tbl_name));
      const totalTables = tables.length;
      const indexedTableCount = tables.filter(table => indexedTables.has(table.name)).length;

      indexEfficiency = totalTables > 0 ? Math.round((indexedTableCount / totalTables) * 100) : 100;
    } catch (error) {
      indexEfficiency = 100;
    }

    return {
      size: databaseSize,
      queryTime,
      connectionCount: 1, // SQLite is single connection
      indexEfficiency
    };
  }

  private async collectRouteTrackingMetrics(): Promise<SystemMetrics['routeTracking']> {
    try {
      // Count active route sessions
      let activeSessions = 0;
      try {
        const result = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM route_sessions 
          WHERE status = 'active'
        `).get() as any;
        activeSessions = result.count || 0;
      } catch (error) {
        // Route sessions table might not exist
      }

      // Count GPS coordinates
      let gpsCoordinatesCount = 0;
      try {
        const result = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM gps_coordinates 
          WHERE timestamp >= datetime('now', '-1 hour')
        `).get() as any;
        gpsCoordinatesCount = result.count || 0;
      } catch (error) {
        // GPS coordinates table might not exist
      }

      // Calculate average accuracy
      let averageAccuracy = 0;
      try {
        const result = this.db.prepare(`
          SELECT AVG(accuracy) as avg_accuracy 
          FROM gps_coordinates 
          WHERE timestamp >= datetime('now', '-1 hour') AND accuracy > 0
        `).get() as any;
        averageAccuracy = Math.round(result.avg_accuracy || 0);
      } catch (error) {
        // GPS coordinates table might not exist or no data
      }

      return {
        activeSessions,
        gpsCoordinatesCount,
        averageAccuracy
      };
    } catch (error) {
      return {
        activeSessions: 0,
        gpsCoordinatesCount: 0,
        averageAccuracy: 0
      };
    }
  }

  private async getDiskUsage(): Promise<{ used: number; total: number; percentage: number }> {
    try {
      // Simplified disk usage - in production, you'd use a proper disk usage library
      return { used: 0, total: 0, percentage: 0 };
    } catch {
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  public async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Collect current metrics
    const currentMetrics = await this.collectMetrics();

    // Convert to individual metrics with thresholds
    const systemMetrics = this.convertToSystemMetrics(currentMetrics);

    // Check service health
    const databaseStatus = await this.checkDatabaseHealth();
    const routeTrackingStatus = await this.checkRouteTrackingHealth();
    const authStatus = await this.checkAuthenticationHealth();
    const fileSystemStatus = await this.checkFileSystemHealth();

    // Determine overall status
    const statuses = [databaseStatus, routeTrackingStatus, authStatus, fileSystemStatus];
    const overallStatus = this.determineOverallStatus(statuses, systemMetrics);

    // Get current alerts
    const currentAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);

    const healthResult: HealthCheckResult = {
      status: overallStatus,
      timestamp,
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: config.environment,
      metrics: systemMetrics,
      services: {
        database: databaseStatus,
        routeTracking: routeTrackingStatus,
        authentication: authStatus,
        fileSystem: fileSystemStatus
      },
      alerts: currentAlerts
    };

    // Check for alerts
    await this.checkAndTriggerAlerts(healthResult);

    return healthResult;
  }

  private convertToSystemMetrics(metrics: SystemMetrics): SystemMetric[] {
    const systemMetrics: SystemMetric[] = [];
    const timestamp = metrics.timestamp;

    // Memory usage
    systemMetrics.push({
      name: 'memory_usage',
      value: metrics.system.memoryUsage.percentage,
      unit: 'percentage',
      status: metrics.system.memoryUsage.used > this.thresholds.maxMemoryUsage
        ? HealthStatus.WARNING : HealthStatus.HEALTHY,
      threshold: (this.thresholds.maxMemoryUsage / metrics.system.memoryUsage.total) * 100,
      timestamp,
      details: metrics.system.memoryUsage
    });

    // Database query time
    systemMetrics.push({
      name: 'database_query_time',
      value: metrics.database.queryTime,
      unit: 'milliseconds',
      status: metrics.database.queryTime > this.thresholds.maxQueryTime
        ? HealthStatus.WARNING : HealthStatus.HEALTHY,
      threshold: this.thresholds.maxQueryTime,
      timestamp
    });

    // Database size
    systemMetrics.push({
      name: 'database_size',
      value: metrics.database.size,
      unit: 'MB',
      status: metrics.database.size > this.thresholds.maxDatabaseSize
        ? HealthStatus.WARNING : HealthStatus.HEALTHY,
      threshold: this.thresholds.maxDatabaseSize,
      timestamp
    });

    // Error rate
    systemMetrics.push({
      name: 'error_rate',
      value: metrics.application.errorRate,
      unit: 'percentage',
      status: metrics.application.errorRate > this.thresholds.maxErrorRate
        ? HealthStatus.WARNING : HealthStatus.HEALTHY,
      threshold: this.thresholds.maxErrorRate,
      timestamp
    });

    // Response time
    systemMetrics.push({
      name: 'response_time',
      value: metrics.application.averageResponseTime,
      unit: 'milliseconds',
      status: metrics.application.averageResponseTime > this.thresholds.maxResponseTime
        ? HealthStatus.WARNING : HealthStatus.HEALTHY,
      threshold: this.thresholds.maxResponseTime,
      timestamp
    });

    return systemMetrics;
  }

  private async checkDatabaseHealth(): Promise<HealthStatus> {
    try {
      const result = this.db.prepare('SELECT 1 as test').get();
      return result && (result as any).test === 1 ? HealthStatus.HEALTHY : HealthStatus.CRITICAL;
    } catch (error) {
      console.error('Database health check failed:', error);
      return HealthStatus.CRITICAL;
    }
  }

  private async checkRouteTrackingHealth(): Promise<HealthStatus> {
    try {
      if (!config.routeTracking.enabled) return HealthStatus.HEALTHY;

      const tables = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('route_sessions', 'gps_coordinates')`
      ).all();

      return tables.length >= 1 ? HealthStatus.HEALTHY : HealthStatus.WARNING;
    } catch (error) {
      console.error('Route tracking health check failed:', error);
      return HealthStatus.CRITICAL;
    }
  }

  private async checkAuthenticationHealth(): Promise<HealthStatus> {
    try {
      const tables = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = 'users'`
      ).all();

      if (tables.length === 0) return HealthStatus.WARNING;

      const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get() as { count: number };
      return userCount.count > 0 ? HealthStatus.HEALTHY : HealthStatus.WARNING;
    } catch (error) {
      console.error('Authentication health check failed:', error);
      return HealthStatus.CRITICAL;
    }
  }

  private async checkFileSystemHealth(): Promise<HealthStatus> {
    try {
      const uploadDir = config.uploads?.storageDir || './uploads';
      if (fs.existsSync(uploadDir)) {
        return fs.statSync(uploadDir).isDirectory() ? HealthStatus.HEALTHY : HealthStatus.WARNING;
      }
      return HealthStatus.WARNING;
    } catch (error) {
      console.error('File system health check failed:', error);
      return HealthStatus.CRITICAL;
    }
  }

  private determineOverallStatus(serviceStatuses: HealthStatus[], metrics: SystemMetric[]): HealthStatus {
    if (serviceStatuses.includes(HealthStatus.CRITICAL)) return HealthStatus.CRITICAL;
    if (metrics.some(m => m.status === HealthStatus.CRITICAL)) return HealthStatus.CRITICAL;
    if (serviceStatuses.includes(HealthStatus.WARNING) || metrics.some(m => m.status === HealthStatus.WARNING))
      return HealthStatus.WARNING;
    return HealthStatus.HEALTHY;
  }

  private storeMetrics(metrics: SystemMetrics): void {
    try {
      const insertMetric = this.db.prepare(`
        INSERT INTO system_metrics (timestamp, metric_name, metric_value, metric_unit, status, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Store key metrics
      insertMetric.run(metrics.timestamp, 'memory_usage', metrics.system.memoryUsage.percentage, 'percentage',
        metrics.system.memoryUsage.used > this.thresholds.maxMemoryUsage ? 'warning' : 'healthy',
        JSON.stringify(metrics.system.memoryUsage));

      insertMetric.run(metrics.timestamp, 'database_query_time', metrics.database.queryTime, 'milliseconds',
        metrics.database.queryTime > this.thresholds.maxQueryTime ? 'warning' : 'healthy', '{}');

      insertMetric.run(metrics.timestamp, 'error_rate', metrics.application.errorRate, 'percentage',
        metrics.application.errorRate > this.thresholds.maxErrorRate ? 'warning' : 'healthy', '{}');

    } catch (error) {
      console.error('Failed to store metrics:', error);
    }
  }

  private async checkAndTriggerAlerts(healthResult: HealthCheckResult): Promise<void> {
    if (!this.config.alerting.enabled) return;

    const newAlerts: Alert[] = [];

    if (healthResult.status === HealthStatus.CRITICAL) {
      newAlerts.push({
        id: `critical-${Date.now()}`,
        type: 'error',
        title: 'System Critical Status',
        message: 'System is in critical state. Immediate attention required.',
        timestamp: new Date().toISOString(),
        resolved: false,
        metadata: { healthResult }
      });
    }

    healthResult.metrics.forEach(metric => {
      if (metric.status === HealthStatus.CRITICAL || metric.status === HealthStatus.WARNING) {
        newAlerts.push({
          id: `metric-${metric.name}-${Date.now()}`,
          type: metric.status === HealthStatus.CRITICAL ? 'error' : 'warning',
          title: `${metric.name.replace('_', ' ').toUpperCase()} Alert`,
          message: `${metric.name} is ${metric.value}${metric.unit}, threshold: ${metric.threshold}${metric.unit}`,
          timestamp: new Date().toISOString(),
          resolved: false,
          metadata: { metric }
        });
      }
    });

    for (const alert of newAlerts) {
      this.alerts.set(alert.id, alert);
      this.storeAlert(alert);
    }
  }

  private storeAlert(alert: Alert): void {
    try {
      this.db.prepare(`
        INSERT INTO system_alerts (id, type, title, message, timestamp, resolved, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(alert.id, alert.type, alert.title, alert.message, alert.timestamp,
        alert.resolved ? 1 : 0, JSON.stringify(alert.metadata || {}));
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }

  // Public methods for application metrics
  public recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    this.totalResponseTime += responseTime;
    if (isError) this.errorCount++;
  }

  public checkPerformanceThresholds(metrics: SystemMetrics): {
    passed: boolean;
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check database query time
    if (metrics.database.queryTime > this.thresholds.maxQueryTime) {
      violations.push(`Database query time (${metrics.database.queryTime}ms) exceeds threshold (${this.thresholds.maxQueryTime}ms)`);
    } else if (metrics.database.queryTime > this.thresholds.maxQueryTime * 0.8) {
      warnings.push(`Database query time (${metrics.database.queryTime}ms) approaching threshold`);
    }

    // Check memory usage
    if (metrics.system.memoryUsage.used > this.thresholds.maxMemoryUsage) {
      violations.push(`Memory usage (${metrics.system.memoryUsage.used}MB) exceeds threshold (${this.thresholds.maxMemoryUsage}MB)`);
    } else if (metrics.system.memoryUsage.used > this.thresholds.maxMemoryUsage * 0.8) {
      warnings.push(`Memory usage (${metrics.system.memoryUsage.used}MB) approaching threshold`);
    }

    // Check database size
    if (metrics.database.size > this.thresholds.maxDatabaseSize) {
      violations.push(`Database size (${metrics.database.size}MB) exceeds threshold (${this.thresholds.maxDatabaseSize}MB)`);
    }

    // Check error rate
    if (metrics.application.errorRate > this.thresholds.maxErrorRate) {
      violations.push(`Error rate (${metrics.application.errorRate}%) exceeds threshold (${this.thresholds.maxErrorRate}%)`);
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings
    };
  }

  public getMetricsHistory(limit?: number): SystemMetrics[] {
    const metricsToReturn = limit ? this.metrics.slice(-limit) : this.metrics;
    return [...metricsToReturn];
  }

  public getAverageMetrics(minutes: number = 5): SystemMetrics | null {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => new Date(m.timestamp) >= cutoffTime);

    if (recentMetrics.length === 0) {
      return null;
    }

    // Calculate averages
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.system.memoryUsage.used, 0) / recentMetrics.length;
    const avgQueryTime = recentMetrics.reduce((sum, m) => sum + m.database.queryTime, 0) / recentMetrics.length;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.application.averageResponseTime, 0) / recentMetrics.length;

    const latest = recentMetrics[recentMetrics.length - 1];

    return {
      ...latest,
      system: {
        ...latest.system,
        memoryUsage: {
          ...latest.system.memoryUsage,
          used: Math.round(avgMemoryUsage)
        }
      },
      database: {
        ...latest.database,
        queryTime: Math.round(avgQueryTime)
      },
      application: {
        ...latest.application,
        averageResponseTime: Math.round(avgResponseTime)
      }
    };
  }

  public startPeriodicCollection(intervalMinutes: number = 1): NodeJS.Timeout {
    log.dev(`📊 Starting performance monitoring (${intervalMinutes} minute intervals)`);

    return setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        const thresholdCheck = this.checkPerformanceThresholds(metrics);

        if (!thresholdCheck.passed) {
          console.warn('⚠️ Performance threshold violations detected:');
          thresholdCheck.violations.forEach(violation => console.warn(`  - ${violation}`));
        }

        if (thresholdCheck.warnings.length > 0) {
          console.warn('⚠️ Performance warnings:');
          thresholdCheck.warnings.forEach(warning => console.warn(`  - ${warning}`));
        }
      } catch (error) {
        console.error('Failed to collect performance metrics:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      try {
        this.db.prepare('UPDATE system_alerts SET resolved = 1 WHERE id = ?').run(alertId);
        return true;
      } catch (error) {
        console.error('Failed to resolve alert:', error);
      }
    }
    return false;
  }

  public getAlerts(resolved: boolean = false): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.resolved === resolved);
  }

  public generatePerformanceReport(): string {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) {
      return 'No performance metrics available';
    }

    const thresholdCheck = this.checkPerformanceThresholds(latestMetrics);
    const averageMetrics = this.getAverageMetrics(5);

    const lines = [
      '# Performance Report',
      `Generated: ${latestMetrics.timestamp}`,
      '',
      '## Current Metrics',
      `- Database Query Time: ${latestMetrics.database.queryTime}ms`,
      `- Memory Usage: ${latestMetrics.system.memoryUsage.used}MB (${latestMetrics.system.memoryUsage.percentage.toFixed(1)}%)`,
      `- Database Size: ${latestMetrics.database.size}MB`,
      `- Error Rate: ${latestMetrics.application.errorRate.toFixed(2)}%`,
      `- System Uptime: ${latestMetrics.system.uptime}s`,
      '',
      '## Threshold Check',
      `Status: ${thresholdCheck.passed ? 'PASS' : 'FAIL'}`,
      ''
    ];

    if (thresholdCheck.violations.length > 0) {
      lines.push('### Violations');
      thresholdCheck.violations.forEach(violation => lines.push(`- ${violation}`));
      lines.push('');
    }

    if (thresholdCheck.warnings.length > 0) {
      lines.push('### Warnings');
      thresholdCheck.warnings.forEach(warning => lines.push(`- ${warning}`));
      lines.push('');
    }

    if (averageMetrics) {
      lines.push('## 5-Minute Averages');
      lines.push(`- Average Query Time: ${averageMetrics.database.queryTime}ms`);
      lines.push(`- Average Memory Usage: ${averageMetrics.system.memoryUsage.used}MB`);
      lines.push(`- Average Response Time: ${averageMetrics.application.averageResponseTime}ms`);
      lines.push('');
    }

    if (latestMetrics.routeTracking) {
      lines.push('## Route Tracking Metrics');
      lines.push(`- Active Sessions: ${latestMetrics.routeTracking.activeSessions}`);
      lines.push(`- GPS Coordinates (last hour): ${latestMetrics.routeTracking.gpsCoordinatesCount}`);
      lines.push(`- Average GPS Accuracy: ${latestMetrics.routeTracking.averageAccuracy}m`);
    }

    return lines.join('\n');
  }

  public cleanup(): void {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
  }
}

export default SystemMonitoringService;