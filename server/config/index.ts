import dotenv from 'dotenv';
import path from 'path';
import { log } from "../../shared/utils/logger.js";

// Load environment variables
dotenv.config();

// Environment types
export type Environment = 'development' | 'staging' | 'production' | 'test';

// Route tracking configuration interface
export interface RouteTrackingConfig {
  enabled: boolean;
  trackingInterval: number; // seconds
  maxCoordinatesPerSession: number;
  dataRetentionDays: number;
  defaultFuelEfficiency: number; // km per liter
  defaultFuelPrice: number; // price per liter
  batteryOptimization: boolean;
  offlineSync: boolean;
  realTimeUpdates: boolean;
  analyticsEnabled: boolean;
  exportEnabled: boolean;
  auditLogging: boolean;
  privacyMode: boolean;
}

// Feature flags interface
export interface FeatureFlags {
  routeTracking: boolean;
  liveTracking: boolean;
  routeAnalytics: boolean;
  routeVisualization: boolean;
  routeOptimization: boolean;
  mobileOptimization: boolean;
  advancedAnalytics: boolean;
  dataExport: boolean;
  auditLogs: boolean;
  privacyControls: boolean;
  databaseOptimization: boolean;
  performanceMonitoring: boolean;
}

// Database configuration
export interface DatabaseConfig {
  path: string;
  backupEnabled: boolean;
  backupInterval: number; // hours
  maxBackups: number;
  vacuumInterval: number; // hours
  walMode: boolean;
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  cacheSize: number; // KB
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
}

// Security configuration
export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  rateLimitWindow: number; // minutes
  rateLimitMax: number;
  sessionTimeout: number; // hours
  maxLoginAttempts: number;
  lockoutDuration: number; // minutes
  auditLogRetention: number; // days
  enableCors: boolean;
  corsOrigins: string[];
}

// Monitoring configuration
export interface MonitoringConfig {
  enabled: boolean;
  healthCheckInterval: number; // seconds
  performanceMetrics: boolean;
  errorTracking: boolean;
  alerting: {
    enabled: boolean;
    email?: {
      enabled: boolean;
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
      };
      recipients: string[];
    };
    webhook?: {
      enabled: boolean;
      url: string;
      secret?: string;
    };
    slack?: {
      enabled: boolean;
      webhookUrl: string;
      channel: string;
    };
  };
  thresholds: {
    errorRate: number; // percentage
    responseTime: number; // milliseconds
    memoryUsage: number; // percentage
    diskUsage: number; // percentage
    databaseSize: number; // MB
  };
}

// Main application configuration
export interface AppConfig {
  environment: Environment;
  port: number;
  host: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  routeTracking: RouteTrackingConfig;
  featureFlags: FeatureFlags;
  database: DatabaseConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  uploads: {
    maxFileSize: number; // MB
    allowedTypes: string[];
    storageDir: string;
  };
}

// Helper function to parse boolean environment variables
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
};

// Helper function to parse number environment variables
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse float environment variables
const parseFloatValue = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse array environment variables
const parseArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
};

// Get current environment
const getEnvironment = (): Environment => {
  const env = process.env.NODE_ENV as Environment;
  if (['development', 'staging', 'production', 'test'].includes(env)) {
    return env;
  }
  return 'development';
};

// Create configuration based on environment
const createConfig = (): AppConfig => {
  const environment = getEnvironment();
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';
  const isTest = environment === 'test';

  return {
    environment,
    port: parseNumber(process.env.PORT, 3001),
    host: process.env.HOST || '0.0.0.0',
    logLevel: (process.env.LOG_LEVEL as any) || (isDevelopment ? 'debug' : 'info'),

    routeTracking: {
      enabled: parseBoolean(process.env.ROUTE_TRACKING_ENABLED, true),
      trackingInterval: parseNumber(process.env.ROUTE_TRACKING_INTERVAL, 30),
      maxCoordinatesPerSession: parseNumber(process.env.MAX_COORDINATES_PER_SESSION, 10000),
      dataRetentionDays: parseNumber(process.env.DATA_RETENTION_DAYS, 90),
      defaultFuelEfficiency: parseFloatValue(process.env.DEFAULT_FUEL_EFFICIENCY, 15.0),
      defaultFuelPrice: parseFloatValue(process.env.DEFAULT_FUEL_PRICE, 1.5),
      batteryOptimization: parseBoolean(process.env.BATTERY_OPTIMIZATION, true),
      offlineSync: parseBoolean(process.env.OFFLINE_SYNC, true),
      realTimeUpdates: parseBoolean(process.env.REAL_TIME_UPDATES, true),
      analyticsEnabled: parseBoolean(process.env.ANALYTICS_ENABLED, true),
      exportEnabled: parseBoolean(process.env.EXPORT_ENABLED, true),
      auditLogging: parseBoolean(process.env.AUDIT_LOGGING, true),
      privacyMode: parseBoolean(process.env.PRIVACY_MODE, false)
    },

    featureFlags: {
      routeTracking: parseBoolean(process.env.FEATURE_ROUTE_TRACKING, true),
      liveTracking: parseBoolean(process.env.FEATURE_LIVE_TRACKING, true),
      routeAnalytics: parseBoolean(process.env.FEATURE_ROUTE_ANALYTICS, true),
      routeVisualization: parseBoolean(process.env.FEATURE_ROUTE_VISUALIZATION, true),
      routeOptimization: parseBoolean(process.env.FEATURE_ROUTE_OPTIMIZATION, true),
      mobileOptimization: parseBoolean(process.env.FEATURE_MOBILE_OPTIMIZATION, true),
      advancedAnalytics: parseBoolean(process.env.FEATURE_ADVANCED_ANALYTICS, isProduction),
      dataExport: parseBoolean(process.env.FEATURE_DATA_EXPORT, true),
      auditLogs: parseBoolean(process.env.FEATURE_AUDIT_LOGS, isProduction),
      privacyControls: parseBoolean(process.env.FEATURE_PRIVACY_CONTROLS, true),
      databaseOptimization: parseBoolean(process.env.FEATURE_DB_OPTIMIZATION, isProduction),
      performanceMonitoring: parseBoolean(process.env.FEATURE_PERFORMANCE_MONITORING, isProduction)
    },

    database: {
      path: process.env.DATABASE_PATH || (isTest ? ':memory:' : './data/main.db'),
      backupEnabled: parseBoolean(process.env.DB_BACKUP_ENABLED, isProduction),
      backupInterval: parseNumber(process.env.DB_BACKUP_INTERVAL, 24),
      maxBackups: parseNumber(process.env.DB_MAX_BACKUPS, 7),
      vacuumInterval: parseNumber(process.env.DB_VACUUM_INTERVAL, 168), // weekly
      walMode: parseBoolean(process.env.DB_WAL_MODE, true),
      journalMode: (process.env.DB_JOURNAL_MODE as any) || 'WAL',
      synchronous: (process.env.DB_SYNCHRONOUS as any) || 'NORMAL',
      cacheSize: parseNumber(process.env.DB_CACHE_SIZE, 10000),
      tempStore: (process.env.DB_TEMP_STORE as any) || 'MEMORY'
    },

    security: {
      jwtSecret: process.env.JWT_SECRET || (isDevelopment ? 'dev-secret-key' : ''),
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      bcryptRounds: parseNumber(process.env.BCRYPT_ROUNDS, 10),
      rateLimitWindow: parseNumber(process.env.RATE_LIMIT_WINDOW, 15),
      rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 100),
      sessionTimeout: parseNumber(process.env.SESSION_TIMEOUT, 24),
      maxLoginAttempts: parseNumber(process.env.MAX_LOGIN_ATTEMPTS, 5),
      lockoutDuration: parseNumber(process.env.LOCKOUT_DURATION, 15),
      auditLogRetention: parseNumber(process.env.AUDIT_LOG_RETENTION, 90),
      enableCors: parseBoolean(process.env.ENABLE_CORS, isDevelopment),
      corsOrigins: parseArray(process.env.CORS_ORIGINS, isDevelopment ? ['http://localhost:3000'] : [])
    },

    monitoring: {
      enabled: parseBoolean(process.env.MONITORING_ENABLED, isProduction),
      healthCheckInterval: parseNumber(process.env.HEALTH_CHECK_INTERVAL, 60),
      performanceMetrics: parseBoolean(process.env.PERFORMANCE_METRICS, isProduction),
      errorTracking: parseBoolean(process.env.ERROR_TRACKING, true),
      alerting: {
        enabled: parseBoolean(process.env.ALERTING_ENABLED, isProduction),
        email: {
          enabled: parseBoolean(process.env.EMAIL_ALERTS_ENABLED, false),
          smtp: {
            host: process.env.SMTP_HOST || '',
            port: parseNumber(process.env.SMTP_PORT, 587),
            secure: parseBoolean(process.env.SMTP_SECURE, false),
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          },
          recipients: parseArray(process.env.ALERT_EMAIL_RECIPIENTS)
        },
        webhook: {
          enabled: parseBoolean(process.env.WEBHOOK_ALERTS_ENABLED, false),
          url: process.env.WEBHOOK_URL || '',
          secret: process.env.WEBHOOK_SECRET
        },
        slack: {
          enabled: parseBoolean(process.env.SLACK_ALERTS_ENABLED, false),
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
          channel: process.env.SLACK_CHANNEL || '#alerts'
        }
      },
      thresholds: {
        errorRate: parseFloatValue(process.env.ERROR_RATE_THRESHOLD, 5.0),
        responseTime: parseNumber(process.env.RESPONSE_TIME_THRESHOLD, 1000),
        memoryUsage: parseFloatValue(process.env.MEMORY_USAGE_THRESHOLD, 80.0),
        diskUsage: parseFloatValue(process.env.DISK_USAGE_THRESHOLD, 85.0),
        databaseSize: parseNumber(process.env.DATABASE_SIZE_THRESHOLD, 1000)
      }
    },

    uploads: {
      maxFileSize: parseNumber(process.env.MAX_FILE_SIZE, 10),
      allowedTypes: parseArray(process.env.ALLOWED_FILE_TYPES, ['image/jpeg', 'image/png', 'image/gif']),
      storageDir: process.env.UPLOAD_DIR || './uploads'
    }
  };
};

// Validate configuration
const validateConfig = (config: AppConfig): void => {
  const errors: string[] = [];

  // Validate required fields
  if (config.environment === 'production') {
    if (!config.security.jwtSecret || config.security.jwtSecret === 'dev-secret-key') {
      errors.push('JWT_SECRET must be set in production');
    }
    if (config.security.jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
  }

  // Validate port range
  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  // Validate tracking interval
  if (config.routeTracking.trackingInterval < 5 || config.routeTracking.trackingInterval > 300) {
    errors.push('ROUTE_TRACKING_INTERVAL must be between 5 and 300 seconds');
  }

  // Validate data retention
  if (config.routeTracking.dataRetentionDays < 1) {
    errors.push('DATA_RETENTION_DAYS must be at least 1');
  }

  // Validate fuel settings
  if (config.routeTracking.defaultFuelEfficiency <= 0) {
    errors.push('DEFAULT_FUEL_EFFICIENCY must be greater than 0');
  }
  if (config.routeTracking.defaultFuelPrice <= 0) {
    errors.push('DEFAULT_FUEL_PRICE must be greater than 0');
  }

  // Validate monitoring thresholds
  if (config.monitoring.thresholds.errorRate < 0 || config.monitoring.thresholds.errorRate > 100) {
    errors.push('ERROR_RATE_THRESHOLD must be between 0 and 100');
  }
  if (config.monitoring.thresholds.memoryUsage < 0 || config.monitoring.thresholds.memoryUsage > 100) {
    errors.push('MEMORY_USAGE_THRESHOLD must be between 0 and 100');
  }
  if (config.monitoring.thresholds.diskUsage < 0 || config.monitoring.thresholds.diskUsage > 100) {
    errors.push('DISK_USAGE_THRESHOLD must be between 0 and 100');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Create and validate configuration
const config = createConfig();
validateConfig(config);

// Export configuration
export default config;

// Export individual config sections for convenience
export const {
  environment,
  port,
  host,
  logLevel,
  routeTracking,
  featureFlags,
  database,
  security,
  monitoring,
  uploads
} = config;

// Utility functions
export const isProduction = () => environment === 'production';
export const isDevelopment = () => environment === 'development';
export const isTest = () => environment === 'test';
export const isStaging = () => environment === 'staging';

// Feature flag checker
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature] === true;
};

// Configuration updater (for runtime configuration changes)
export const updateFeatureFlag = (feature: keyof FeatureFlags, enabled: boolean): void => {
  featureFlags[feature] = enabled;
  log.dev(`Feature flag ${feature} ${enabled ? 'enabled' : 'disabled'}`);
};

// Get configuration summary for debugging
export const getConfigSummary = () => {
  return {
    environment,
    port,
    routeTrackingEnabled: routeTracking.enabled,
    featuresEnabled: Object.entries(featureFlags)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature),
    monitoringEnabled: monitoring.enabled,
    databasePath: database.path
  };
};