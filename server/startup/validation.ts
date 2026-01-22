import SystemValidationService from '../services/SystemValidationService.js';
import IntegrationChecker from '../services/IntegrationChecker.js';
import { storage } from '../storage';
import config from '../config';
import { log } from "../../shared/utils/logger.js";

interface StartupValidationResult {
  success: boolean;
  systemValidation?: any;
  integrationTests?: any;
  errors: string[];
  warnings: string[];
}

export async function runStartupValidation(): Promise<StartupValidationResult> {
  log.dev('🚀 Running startup validation...');

  const result: StartupValidationResult = {
    success: true,
    errors: [],
    warnings: []
  };

  try {
    // Initialize services
    const systemValidator = SystemValidationService.getInstance(storage.getDatabase());
    const integrationChecker = IntegrationChecker.getInstance(storage.getDatabase());

    // Run system validation
    log.dev('📋 Running system validation...');
    try {
      const systemValidation = await systemValidator.runFullValidation();
      result.systemValidation = systemValidation;

      if (systemValidation.overallStatus === 'FAIL') {
        result.success = false;
        result.errors.push('System validation failed');

        // Log specific failures
        if (!systemValidation.shipmentFunctionality.passed) {
          result.errors.push(`Shipment functionality: ${systemValidation.shipmentFunctionality.message}`);
        }
        if (!systemValidation.routeTrackingToggle.passed) {
          result.errors.push(`Route tracking toggle: ${systemValidation.routeTrackingToggle.message}`);
        }
        if (!systemValidation.systemPerformance.passed) {
          result.errors.push(`System performance: ${systemValidation.systemPerformance.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`System validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Run integration tests
    log.dev('🔧 Running integration tests...');
    try {
      const integrationTests = await integrationChecker.runAllTests();
      result.integrationTests = integrationTests;

      if (integrationTests.overallStatus === 'FAIL') {
        result.success = false;
        result.errors.push('Integration tests failed');

        // Log specific test failures
        integrationTests.tests.forEach(test => {
          if (!test.passed) {
            result.errors.push(`Integration test '${test.name}': ${test.message}`);
          }
        });
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Integration tests error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Additional startup checks
    log.dev('⚙️ Running additional startup checks...');

    // Check configuration consistency
    if (config.routeTracking.enabled && !config.featureFlags.routeTracking) {
      result.warnings.push('Route tracking is enabled in config but disabled in feature flags');
    }

    // Check database connection
    try {
      storage.getDatabase().prepare('SELECT 1').get();
    } catch (error) {
      result.success = false;
      result.errors.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check required environment variables in production
    if (config.environment === 'production') {
      if (!config.security.jwtSecret || config.security.jwtSecret === 'dev-secret-key') {
        result.success = false;
        result.errors.push('JWT_SECRET must be set in production');
      }
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    if (memUsageMB > 100) {
      result.warnings.push(`High memory usage at startup: ${memUsageMB.toFixed(2)}MB`);
    }

    // Log results
    if (result.success) {
      log.dev('✅ Startup validation completed successfully');
      if (result.warnings.length > 0) {
        log.dev('⚠️ Warnings:');
        result.warnings.forEach(warning => log.dev(`  - ${warning}`));
      }
    } else {
      log.dev('❌ Startup validation failed');
      log.dev('🚨 Errors:');
      result.errors.forEach(error => log.dev(`  - ${error}`));
      if (result.warnings.length > 0) {
        log.dev('⚠️ Warnings:');
        result.warnings.forEach(warning => log.dev(`  - ${warning}`));
      }
    }

    return result;

  } catch (error) {
    console.error('💥 Startup validation crashed:', error);
    return {
      success: false,
      errors: [`Startup validation crashed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: []
    };
  }
}

export function validateEnvironmentConfiguration(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 16) {
    errors.push(`Node.js version ${nodeVersion} is not supported. Minimum version is 16.x`);
  }

  // Check environment variables
  const requiredEnvVars = ['NODE_ENV'];
  const recommendedEnvVars = ['PORT', 'DATABASE_PATH'];

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      errors.push(`Required environment variable ${envVar} is not set`);
    }
  });

  recommendedEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      warnings.push(`Recommended environment variable ${envVar} is not set`);
    }
  });

  // Check production-specific requirements
  if (config.environment === 'production') {
    const productionRequiredVars = ['JWT_SECRET'];
    productionRequiredVars.forEach(envVar => {
      if (!process.env[envVar] || process.env[envVar] === 'dev-secret-key') {
        errors.push(`Production environment variable ${envVar} must be set to a secure value`);
      }
    });
  }

  // Check configuration consistency
  if (config.routeTracking.enabled && !config.featureFlags.routeTracking) {
    warnings.push('Route tracking configuration inconsistency detected');
  }

  // Check port availability (basic check)
  if (config.port < 1024 && process.getuid && process.getuid() !== 0) {
    warnings.push(`Port ${config.port} requires root privileges on Unix systems`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function logSystemInfo(): void {
  log.dev('📊 System Information:');
  log.dev(`  Node.js: ${process.version}`);
  log.dev(`  Platform: ${process.platform}`);
  log.dev(`  Architecture: ${process.arch}`);
  log.dev(`  Environment: ${config.environment}`);
  log.dev(`  Port: ${config.port}`);
  log.dev(`  Database: ${config.database.path}`);
  log.dev(`  Route Tracking: ${config.routeTracking.enabled ? 'enabled' : 'disabled'}`);
  log.dev(`  Feature Flags: ${Object.entries(config.featureFlags).filter(([, enabled]) => enabled).map(([flag]) => flag).join(', ')}`);

  const memUsage = process.memoryUsage();
  log.dev(`  Memory Usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
}