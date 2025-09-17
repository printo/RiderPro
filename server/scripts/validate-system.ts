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
import SystemMonitoringService from '../services/SystemMonitoringService';
import { runStartupValidation, validateEnvironmentConfiguration, logSystemInfo } from '../startup/validation';
import config from '../config';

interface ValidationOptions {
  verbose?: boolean;
  skipPerformance?: boolean;
  skipIntegration?: boolean;
  generateReport?: boolean;
  outputFile?: string;
}

class SystemValidator {
  private options: ValidationOptions;
  private results: {
    environment: any;
    startup: any;
    system: any;
    integration: any;
    performance: any;
  } = {
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
    console.log('🚀 Starting comprehensive system validation...\n');

    let overallSuccess = true;

    try {
      // Step 1: Environment Configuration Validation
      console.log('📋 Step 1: Environment Configuration Validation');
      this.results.environment = this.validateEnvironment();
      if (!this.results.environment.valid) {
        overallSuccess = false;
        console.log('❌ Environment validation failed');
        this.results.environment.errors.forEach((error: string) => console.log(`  - ${error}`));
      } else {
        console.log('✅ Environment validation passed');
      }
      console.log('');

      // Step 2: Startup Validation
      console.log('🔧 Step 2: Startup Validation');
      this.results.startup = await runStartupValidation();
      if (!this.results.startup.success) {
        overallSuccess = false;
        console.log('❌ Startup validation failed');
        this.results.startup.errors.forEach((error: string) => console.log(`  - ${error}`));
      } else {
        console.log('✅ Startup validation passed');
      }
      console.log('');

      // Step 3: System Validation
      console.log('🔍 Step 3: System Validation');
      const systemValidator = SystemValidationService.getInstance(storage.getDatabase());
      this.results.system = await systemValidator.runFullValidation();
      if (this.results.system.overallStatus === 'FAIL') {
        overallSuccess = false;
        console.log('❌ System validation failed');
      } else {
        console.log('✅ System validation passed');
      }
      console.log('');

      // Step 4: Integration Testing
      if (!this.options.skipIntegration) {
        console.log('🔧 Step 4: Integration Testing');
        const integrationChecker = IntegrationChecker.getInstance(storage.getDatabase());
        this.results.integration = await integrationChecker.runAllTests();
        if (this.results.integration.overallStatus === 'FAIL') {
          overallSuccess = false;
          console.log('❌ Integration tests failed');
        } else {
          console.log('✅ Integration tests passed');
        }
        console.log('');
      }

      // Step 5: Performance Validation
      if (!this.options.skipPerformance) {
        console.log('⚡ Step 5: Performance Validation');
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
          console.log('❌ Performance validation failed');
          thresholdCheck.violations.forEach(violation => console.log(`  - ${violation}`));
        } else {
          console.log('✅ Performance validation passed');
        }
        console.log('');
      }

      // Generate Report
      if (this.options.generateReport) {
        await this.generateValidationReport();
      }

      // Final Summary
      console.log('📊 Validation Summary');
      console.log('='.repeat(50));
      console.log(`Overall Status: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Environment: ${this.results.environment.valid ? '✅' : '❌'}`);
      console.log(`Startup: ${this.results.startup.success ? '✅' : '❌'}`);
      console.log(`System: ${this.results.system.overallStatus === 'PASS' ? '✅' : '❌'}`);
      if (!this.options.skipIntegration) {
        console.log(`Integration: ${this.results.integration.overallStatus === 'PASS' ? '✅' : '❌'}`);
      }
      if (!this.options.skipPerformance) {
        console.log(`Performance: ${this.results.performance.passed ? '✅' : '❌'}`);
      }
      console.log('='.repeat(50));

      if (overallSuccess) {
        console.log('🎉 All validation checks passed! System is ready for deployment.');
      } else {
        console.log('🚨 Some validation checks failed. Please review the issues above.');
      }

      return overallSuccess;

    } catch (error) {
      console.error('💥 Validation process crashed:', error);
      return false;
    }
  }

  private validateEnvironment() {
    console.log('  Checking environment configuration...');
    const envValidation = validateEnvironmentConfiguration();

    if (this.options.verbose) {
      logSystemInfo();
    }

    return envValidation;
  }

  private async generateValidationReport(): Promise<void> {
    console.log('📄 Generating validation report...');

    const timestamp = new Date().toISOString();
    const reportLines = [
      '# System Validation Report',
      `Generated: ${timestamp}`,
      `Environment: ${config.environment}`,
      `Node.js Version: ${process.version}`,
      '',
      '## Executive Summary',
      `- Environment Configuration: ${this.results.environment.valid ? 'PASS' : 'FAIL'}`,
      `- Startup Validation: ${this.results.startup.success ? 'PASS' : 'FAIL'}`,
      `- System Validation: ${this.results.system.overallStatus}`,
      this.results.integration ? `- Integration Tests: ${this.results.integration.overallStatus}` : '',
      this.results.performance ? `- Performance Tests: ${this.results.performance.passed ? 'PASS' : 'FAIL'}` : '',
      '',
      '## Detailed Results',
      ''
    ];

    // Environment Details
    reportLines.push('### Environment Configuration');
    reportLines.push(`Status: ${this.results.environment.valid ? 'PASS' : 'FAIL'}`);
    if (this.results.environment.errors.length > 0) {
      reportLines.push('**Errors:**');
      this.results.environment.errors.forEach((error: string) => reportLines.push(`- ${error}`));
    }
    if (this.results.environment.warnings.length > 0) {
      reportLines.push('**Warnings:**');
      this.results.environment.warnings.forEach((warning: string) => reportLines.push(`- ${warning}`));
    }
    reportLines.push('');

    // System Validation Details
    reportLines.push('### System Validation');
    reportLines.push(`Status: ${this.results.system.overallStatus}`);
    reportLines.push(`Shipment Functionality: ${this.results.system.shipmentFunctionality.passed ? 'PASS' : 'FAIL'}`);
    reportLines.push(`Route Tracking Toggle: ${this.results.system.routeTrackingToggle.passed ? 'PASS' : 'FAIL'}`);
    reportLines.push(`System Performance: ${this.results.system.systemPerformance.passed ? 'PASS' : 'FAIL'}`);
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
          .filter((test: any) => !test.passed)
          .forEach((test: any) => reportLines.push(`- ${test.name}: ${test.message}`));
      }
      reportLines.push('');
    }

    // Performance Details
    if (this.results.performance) {
      reportLines.push('### Performance Metrics');
      reportLines.push(`Status: ${this.results.performance.passed ? 'PASS' : 'FAIL'}`);
      reportLines.push(`Database Query Time: ${this.results.performance.metrics.databaseMetrics.queryTime}ms`);
      reportLines.push(`Memory Usage: ${this.results.performance.metrics.memoryMetrics.heapUsed}MB`);
      reportLines.push(`Database Size: ${this.results.performance.metrics.databaseMetrics.databaseSize}MB`);

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
    reportLines.push(`Database Path: ${config.database.path}`);
    reportLines.push(`Monitoring Enabled: ${config.monitoring.enabled}`);

    const reportContent = reportLines.filter(line => line !== '').join('\n');

    // Write to file if specified, otherwise just log
    if (this.options.outputFile) {
      const fs = await import('fs/promises');
      await fs.writeFile(this.options.outputFile, reportContent);
      console.log(`  Report saved to: ${this.options.outputFile}`);
    } else {
      console.log('  Report generated (use --output-file to save to disk)');
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
        console.log(`
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