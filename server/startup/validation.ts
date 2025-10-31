import { storage } from '../storage';
import config from '../config';

interface StartupValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export async function runStartupValidation(): Promise<StartupValidationResult> {
  console.log('🚀 Running startup validation...');

  const result: StartupValidationResult = {
    success: true,
    errors: [],
    warnings: []
  };

  try {
    // Additional startup checks
    console.log('⚙️ Running startup checks...');

    // Check database connection (PostgreSQL)
    try {
      const db = storage.getDatabase();
      await db.query('SELECT 1');
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
      console.log('✅ Startup validation completed successfully');
      if (result.warnings.length > 0) {
        console.log('⚠️ Warnings:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
    } else {
      console.log('❌ Startup validation failed');
      console.log('🚨 Errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
      if (result.warnings.length > 0) {
        console.log('⚠️ Warnings:');
        result.warnings.forEach(warning => console.log(`  - ${warning}`));
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

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      errors.push(`Required environment variable ${envVar} is not set`);
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

  // Check port range (validation only, not availability)
  if (config.port < 1 || config.port > 65535) {
    errors.push(`PORT must be between 1 and 65535, got ${config.port}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function logSystemInfo(): void {
  console.log('📊 System Information:');
  console.log(`  Node.js: ${process.version}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  Architecture: ${process.arch}`);
  console.log(`  Environment: ${config.environment}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Database: PostgreSQL (via DATABASE_URL)`);
  console.log(`  Route Tracking: ${config.routeTracking.enabled ? 'enabled' : 'disabled'}`);

  const memUsage = process.memoryUsage();
  console.log(`  Memory Usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
}