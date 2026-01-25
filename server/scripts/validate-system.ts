#!/usr/bin/env node

/**
 * System Validation Script
 * 
 * This script runs comprehensive validation checks to ensure:
 * 1. Existing shipment functionality remains unaffected
 * 2. Route tracking module can be disabled/enabled properly
 * 3. System performance meets requirements
 * 
 * Usage: npm run validate-system
 */

import { storage } from '../storage';
import SystemValidationService from '../services/SystemValidationService.js';
import IntegrationChecker from '../services/IntegrationChecker.js';
import SystemMonitoringService, { SystemMetrics } from '../services/SystemMonitoringService';
import { runStartupValidation, validateEnvironmentConfiguration, logSystemInfo } from '../startup/validation';
import config from '../config';
import { log } from "../../shared/utils/logger.js";

interface ValidationOptions {
  verbose?: boolean;
  skipPerformance?: boolean;
  skipIntegration?: boolean;
  generateReport?: boolean;
  outputFile?: string;
}

interface ValidationTest {
  name: string;
  passed: boolean;
  message: string;
}

interface ValidationSummary {
  failed: number;
  total?: number;
  passed?: number;
}

interface IntegrationResult {
  summary: ValidationSummary;
  tests: ValidationTest[];
  overallStatus?: string;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

interface EnvironmentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface StartupValidationResult {
  success: boolean;
  systemValidation?: unknown;
  integrationTests?: unknown;
  errors: string[];
  warnings: string[];
}

interface SystemValidationReport {
  timestamp: string;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  shipmentFunctionality: ValidationResult;
  routeTrackingToggle: ValidationResult;
  systemPerformance: ValidationResult;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface PerformanceValidationResult {
  metrics: SystemMetrics;
  thresholdCheck: {
    passed: boolean;
    violations: string[];
    warnings: string[];
  };
  passed: boolean;
}

interface ValidationResults {
  environment: EnvironmentValidationResult | null;
  startup: StartupValidationResult | null;
  system: SystemValidationReport | null;
  integration: IntegrationResult | null;
  performance: PerformanceValidationResult | null;
}

class SystemValidator {
  private options: ValidationOptions;
  private results: ValidationResults = {
    environment: null,
    startup: null,
    system: null,
    integration: null,
    performance: null
  };

  constructor(options: ValidationOptions = {}) {
    this.options = {
      verbose: false,
      skipPerformance: false,
      skipIntegration: false,
      generateReport: true,
      ...options
    };
  }

  async runValidation(): Promise<boolean> {
    log.dev('🚀 Starting comprehensive system validation...\n');

    let overallSuccess = true;

    try {
      // Step 1: Environment Configuration Validation
      log.dev('📋 Step 1: Environment Configuration Validation');
      this.results.environment = this.validateEnvironment();
      if (!this.results.environment.valid) {
        overallSuccess = false;
        log.dev('❌ Environment validation failed');
        this.results.environment.errors.forEach((error: string) => log.dev(`  - ${error}`));
      } else {
        log.dev('✅ Environment validation passed');
      }
      log.dev('');

      // Step 2: Startup Validation
      log.dev('🔧 Step 2: Startup Validation');
      this.results.startup = await runStartupValidation();
      if (!this.results.startup.success) {
        overallSuccess = false;
        log.dev('❌ Startup validation failed');
        this.results.startup.errors.forEach((error: string) => log.dev(`  - ${error}`));
      } else {
        log.dev('✅ Startup validation passed');
      }
      log.dev('');

      // Step 3: System Validation
      log.dev('🔍 Step 3: System Validation');
      const systemValidator = SystemValidationService.getInstance();
      this.results.system = await systemValidator.runFullValidation();
      if (this.results.system.overallStatus === 'FAIL') {
        overallSuccess = false;
        log.dev('❌ System validation failed');
      } else {
        log.dev('✅ System validation passed');
      }
      log.dev('');

      // Step 4: Integration Testing
      if (!this.options.skipIntegration) {
        log.dev('🔧 Step 4: Integration Testing');
        const integrationChecker = IntegrationChecker.getInstance();
        this.results.integration = await integrationChecker.runAllTests();
        if (this.results.integration.overallStatus === 'FAIL') {
          overallSuccess = false;
          log.dev('❌ Integration tests failed');
        } else {
          log.dev('✅ Integration tests passed');
        }
        log.dev('');
      }

      // Step 5: Performance Validation
      if (!this.options.skipPerformance) {
        log.dev('⚡ Step 5: Performance Validation');
        const performanceMonitor = SystemMonitoringService.getInstance(storage.getDatabase(), config.monitoring);
        const metrics = await performanceMonitor.collectMetrics();
        const thresholdCheck = performanceMonitor.checkPerformanceThresholds(metrics);

        this.results.performance = {
          metrics,
          thresholdCheck,
          passed: thresholdCheck.passed
        };

        if (!thresholdCheck.passed) {
          overallSuccess = false;
          log.dev('❌ Performance validation failed');
          thresholdCheck.violations.forEach(violation => log.dev(`  - ${violation}`));
        } else {
          log.dev('✅ Performance validation passed');
        }
        log.dev('');
      }

      // Generate Report
      if (this.options.generateReport) {
        await this.generateValidationReport();
      }

      // Final Summary
      log.dev('📊 Validation Summary');
      log.dev('='.repeat(50));
      log.dev(`Overall Status: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
      log.dev(`Environment: ${this.results.environment?.valid ? '✅' : '❌'}`);
      log.dev(`Startup: ${this.results.startup?.success ? '✅' : '❌'}`);
      log.dev(`System: ${this.results.system?.overallStatus === 'PASS' ? '✅' : '❌'}`);
      if (!this.options.skipIntegration) {
        log.dev(`Integration: ${this.results.integration?.overallStatus === 'PASS' ? '✅' : '❌'}`);
      }
      if (!this.options.skipPerformance) {
        log.dev(`Performance: ${this.results.performance?.passed ? '✅' : '❌'}`);
      }
      log.dev('='.repeat(50));

      if (overallSuccess) {
        log.dev('🎉 All validation checks passed! System is ready for deployment.');
      } else {
        log.dev('🚨 Some validation checks failed. Please review the issues above.');
      }

      return overallSuccess;

    } catch (error) {
      console.error('💥 Validation process crashed:', error);
      return false;
    }
  }

  private validateEnvironment() {
    log.dev('  Checking environment configuration...');
    const envValidation = validateEnvironmentConfiguration();

    if (this.options.verbose) {
      logSystemInfo();
    }

    return envValidation;
  }

  private async generateValidationReport(): Promise<void> {
    log.dev('📄 Generating validation report...');

    const timestamp = new Date().toISOString();
    const reportLines = [
      '# System Validation Report',
      `Generated: ${timestamp}`,
      `Environment: ${config.environment}`,
      `Node.js Version: ${process.version}`,
      '',
      '## Executive Summary',
      `- Environment Configuration: ${this.results.environment?.valid ? 'PASS' : 'FAIL'}`,
      `- Startup Validation: ${this.results.startup?.success ? 'PASS' : 'FAIL'}`,
      `- System Validation: ${this.results.system?.overallStatus ?? 'N/A'}`,
      this.results.integration ? `- Integration Tests: ${this.results.integration.overallStatus}` : '',
      this.results.performance ? `- Performance Tests: ${this.results.performance.passed ? 'PASS' : 'FAIL'}` : '',
      '',
      '## Detailed Results',
      ''
    ];

    // Environment Details
    reportLines.push('### Environment Configuration');
    reportLines.push(`Status: ${this.results.environment?.valid ? 'PASS' : 'FAIL'}`);
    if (this.results.environment?.errors && this.results.environment.errors.length > 0) {
      reportLines.push('**Errors:**');
      this.results.environment.errors.forEach((error: string) => reportLines.push(`- ${error}`));
    }
    if (this.results.environment?.warnings && this.results.environment.warnings.length > 0) {
      reportLines.push('**Warnings:**');
      this.results.environment.warnings.forEach((warning: string) => reportLines.push(`- ${warning}`));
    }
    reportLines.push('');

    // System Validation Details
    reportLines.push('### System Validation');
    reportLines.push(`Status: ${this.results.system?.overallStatus ?? 'N/A'}`);
    reportLines.push(`Shipment Functionality: ${this.results.system?.shipmentFunctionality.passed ? 'PASS' : 'FAIL'}`);
    reportLines.push(`Route Tracking Toggle: ${this.results.system?.routeTrackingToggle.passed ? 'PASS' : 'FAIL'}`);
    reportLines.push(`System Performance: ${this.results.system?.systemPerformance.passed ? 'PASS' : 'FAIL'}`);
    reportLines.push('');

    // Integration Test Details
    if (this.results.integration) {
      reportLines.push('### Integration Tests');
      reportLines.push(`Status: ${this.results.integration.overallStatus}`);
      reportLines.push(`Total Tests: ${this.results.integration.summary.total}`);
      reportLines.push(`Passed: ${this.results.integration.summary.passed}`);
      reportLines.push(`Failed: ${this.results.integration.summary.failed}`);

      if (this.results.integration.summary.failed > 0) {
        reportLines.push('**Failed Tests:**');
        this.results.integration.tests
          .filter((test: ValidationTest) => !test.passed)
          .forEach((test: ValidationTest) => reportLines.push(`- ${test.name}: ${test.message}`));
      }
      reportLines.push('');
    }

    // Performance Details
    if (this.results.performance) {
      reportLines.push('### Performance Metrics');
      reportLines.push(`Status: ${this.results.performance.passed ? 'PASS' : 'FAIL'}`);
      reportLines.push(`Database Query Time: ${this.results.performance.metrics.database.queryTime}ms`);
      reportLines.push(`Memory Usage: ${this.results.performance.metrics.system.memoryUsage.heap.used}MB`);
      reportLines.push(`Database Size: ${this.results.performance.metrics.database.size}MB`);

      if (this.results.performance.thresholdCheck.violations.length > 0) {
        reportLines.push('**Performance Violations:**');
        this.results.performance.thresholdCheck.violations.forEach((violation: string) =>
          reportLines.push(`- ${violation}`)
        );
      }
      reportLines.push('');
    }

    // Configuration Summary
    reportLines.push('### Configuration Summary');
    reportLines.push(`Route Tracking Enabled: ${config.routeTracking.enabled}`);
    reportLines.push(`Feature Flags Enabled: ${Object.entries(config.featureFlags).filter(([, enabled]) => enabled).map(([flag]) => flag).join(', ')}`);
    reportLines.push(`Database URL: ${config.database.url.split('@')[1] || 'PostgreSQL'}`);
    reportLines.push(`Monitoring Enabled: ${config.monitoring.enabled}`);

    const reportContent = reportLines.filter(line => line !== '').join('\n');

    // Write to file if specified, otherwise just log
    if (this.options.outputFile) {
      const fs = await import('fs/promises');
      await fs.writeFile(this.options.outputFile, reportContent);
      log.dev(`  Report saved to: ${this.options.outputFile}`);
    } else {
      log.dev('  Report generated (use --output-file to save to disk)');
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--skip-performance':
        options.skipPerformance = true;
        break;
      case '--skip-integration':
        options.skipIntegration = true;
        break;
      case '--no-report':
        options.generateReport = false;
        break;
      case '--output-file':
      case '-o':
        if (i + 1 < args.length) {
          options.outputFile = args[i + 1];
          i++; // Skip next argument
        }
        break;
      case '--help':
      case '-h':
        log.dev(`
System Validation Script

Usage: npm run validate-system [options]

Options:
  --verbose, -v           Show detailed output
  --skip-performance      Skip performance validation
  --skip-integration      Skip integration tests
  --no-report            Don't generate validation report
  --output-file, -o FILE  Save report to specified file
  --help, -h             Show this help message

Examples:
  npm run validate-system
  npm run validate-system --verbose
  npm run validate-system --output-file validation-report.md
  npm run validate-system --skip-performance --skip-integration
        `);
        process.exit(0);
    }
  }

  const validator = new SystemValidator(options);
  const success = await validator.runValidation();

  process.exit(success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}

export { SystemValidator };
export default SystemValidator;