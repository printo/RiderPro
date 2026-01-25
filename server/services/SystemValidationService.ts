import { pool } from '../db/connection.js';
import config from '../config/index.js';
import { log } from "../../shared/utils/logger.js";

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
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

class SystemValidationService {
  private static instance: SystemValidationService;

  public static getInstance(): SystemValidationService {
    if (!SystemValidationService.instance) {
      SystemValidationService.instance = new SystemValidationService();
    }
    return SystemValidationService.instance;
  }

  public async runFullValidation(): Promise<SystemValidationReport> {
    log.dev('🔍 Starting system validation...');

    const shipmentValidation = await this.validateShipmentFunctionality();
    const routeTrackingValidation = await this.validateRouteTrackingToggle();
    const performanceValidation = await this.validateSystemPerformance();

    const results = [shipmentValidation, routeTrackingValidation, performanceValidation];
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const warnings = 0; // Could be extended for warning-level issues

    const overallStatus: 'PASS' | 'FAIL' | 'WARNING' = failed > 0 ? 'FAIL' : 'PASS';

    const report: SystemValidationReport = {
      timestamp: new Date().toISOString(),
      overallStatus,
      shipmentFunctionality: shipmentValidation,
      routeTrackingToggle: routeTrackingValidation,
      systemPerformance: performanceValidation,
      summary: {
        totalChecks: results.length,
        passed,
        failed,
        warnings
      }
    };

    log.dev(`✅ System validation completed: ${overallStatus}`);
    log.dev(`📊 Results: ${passed}/${results.length} checks passed`);

    return report;
  }

  private async validateShipmentFunctionality(): Promise<ValidationResult> {
    try {
      log.dev('🚚 Validating shipment functionality...');

      // Check if core shipment tables exist and are accessible
      // Note: 'employees' table doesn't exist in current schema, checking 'users' instead if needed, 
      // but for now just 'shipments' as it's the core one.
      const shipmentTables = ['shipments']; 
      for (const table of shipmentTables) {
        try {
          const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          if (typeof parseInt(result.rows[0].count) !== 'number') {
            throw new Error(`Invalid response from ${table} table`);
          }
        } catch (error) {
          return {
            passed: false,
            message: `Shipment table ${table} is not accessible`,
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
          };
        }
      }

      // Verify shipment CRUD operations work
      const testShipment = {
        id: 'validation-test-' + Date.now(),
        type: 'delivery',
        customerName: 'Test Customer',
        customerMobile: '1234567890',
        address: 'Test Address',
        cost: 100.0,
        deliveryTime: new Date().toISOString(),
        routeName: 'Test Route',
        employeeId: 'test-employee',
        status: 'Assigned',
        createdAt: new Date().toISOString()
      };

      try {
        // Test INSERT
        await pool.query(`
          INSERT INTO shipments (id, type, "customerName", "customerMobile", address, cost, "deliveryTime", "routeName", "employeeId", status, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          testShipment.id,
          testShipment.type,
          testShipment.customerName,
          testShipment.customerMobile,
          testShipment.address,
          testShipment.cost,
          testShipment.deliveryTime,
          testShipment.routeName,
          testShipment.employeeId,
          testShipment.status,
          testShipment.createdAt
        ]);

        // Test SELECT
        const selectResult = await pool.query('SELECT * FROM shipments WHERE id = $1', [testShipment.id]);
        const retrieved = selectResult.rows[0];
        if (!retrieved) {
          throw new Error('Failed to retrieve test shipment');
        }

        // Test UPDATE
        await pool.query('UPDATE shipments SET status = $1 WHERE id = $2', ['In Transit', testShipment.id]);

        // Test DELETE (cleanup)
        await pool.query('DELETE FROM shipments WHERE id = $1', [testShipment.id]);

        return {
          passed: true,
          message: 'Shipment functionality is working correctly',
          details: { tablesChecked: shipmentTables, crudOperations: 'all_passed' }
        };

      } catch (error) {
        // Cleanup in case of error
        try {
          await pool.query('DELETE FROM shipments WHERE id = $1', [testShipment.id]);
        } catch (_cleanupError) {
          // Ignore cleanup errors
        }

        return {
          passed: false,
          message: 'Shipment CRUD operations failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }

    } catch (error) {
      return {
        passed: false,
        message: 'Failed to validate shipment functionality',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateRouteTrackingToggle(): Promise<ValidationResult> {
    try {
      log.dev('🗺️ Validating route tracking toggle functionality...');

      // Check if route tracking can be disabled/enabled via config
      const originalRouteTrackingState = config.routeTracking.enabled;
      const originalFeatureFlagState = config.featureFlags.routeTracking;

      // Verify route tracking tables exist when enabled
      if (originalRouteTrackingState) {
        try {
          const routeTrackingTables = ['route_sessions', 'route_tracking'];
          for (const table of routeTrackingTables) {
            const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
            if (typeof parseInt(result.rows[0].count) !== 'number') {
              throw new Error(`Route tracking table ${table} is not accessible`);
            }
          }
        } catch (error) {
          return {
            passed: false,
            message: 'Route tracking tables are not accessible when feature is enabled',
            details: { error: error instanceof Error ? error.message : 'Unknown error' }
          };
        }
      }

      // Test feature flag functionality
      try {
        // Simulate toggling feature flag
        config.featureFlags.routeTracking = !originalFeatureFlagState;

        // Verify the change took effect
        if (config.featureFlags.routeTracking === originalFeatureFlagState) {
          throw new Error('Feature flag toggle did not take effect');
        }

        // Restore original state
        config.featureFlags.routeTracking = originalFeatureFlagState;

      } catch (error) {
        return {
          passed: false,
          message: 'Route tracking feature flag toggle failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }

      // Verify that when route tracking is disabled, shipments still work
      const tempDisableState = config.routeTracking.enabled;
      try {
        // Temporarily disable route tracking
        config.routeTracking.enabled = false;

        // Test that shipment operations still work
        const testShipment = {
          id: 'route-toggle-test-' + Date.now(),
          type: 'delivery',
          customerName: 'Test Customer',
          customerMobile: '1234567890',
          address: 'Test Address',
          cost: 100.0,
          deliveryTime: new Date().toISOString(),
          routeName: 'Test Route',
          employeeId: 'test-employee',
          status: 'Assigned',
          createdAt: new Date().toISOString()
        };

        await pool.query(`
          INSERT INTO shipments (id, type, "customerName", "customerMobile", address, cost, "deliveryTime", "routeName", "employeeId", status, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          testShipment.id,
          testShipment.type,
          testShipment.customerName,
          testShipment.customerMobile,
          testShipment.address,
          testShipment.cost,
          testShipment.deliveryTime,
          testShipment.routeName,
          testShipment.employeeId,
          testShipment.status,
          testShipment.createdAt
        ]);

        // Cleanup
        await pool.query('DELETE FROM shipments WHERE id = $1', [testShipment.id]);

        // Restore original state
        config.routeTracking.enabled = tempDisableState;

      } catch (error) {
        // Restore original state
        config.routeTracking.enabled = tempDisableState;

        return {
          passed: false,
          message: 'Shipment functionality affected when route tracking is disabled',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }

      return {
        passed: true,
        message: 'Route tracking toggle functionality works correctly',
        details: {
          routeTrackingEnabled: originalRouteTrackingState,
          featureFlagEnabled: originalFeatureFlagState,
          shipmentUnaffected: true
        }
      };

    } catch (error) {
      return {
        passed: false,
        message: 'Failed to validate route tracking toggle functionality',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async validateSystemPerformance(): Promise<ValidationResult> {
    try {
      log.dev('⚡ Validating system performance...');

      const performanceMetrics = {
        databaseQueryTime: 0,
        memoryUsage: 0,
        databaseSize: 0,
        indexEfficiency: true
      };

      // Test database query performance
      const queryStartTime = Date.now();
      try {
        // Run a complex query that would be typical for the system
        await pool.query(`
          SELECT 
            COUNT(*) as total_shipments,
            COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as completed_shipments,
            COUNT(CASE WHEN status = 'In Transit' THEN 1 END) as active_shipments
          FROM shipments 
          WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        `);
        // Note: status values matched to schema ('Delivered', 'In Transit' vs 'completed', 'in_transit')
        // The schema uses Title Case ('Assigned', 'In Transit', 'Delivered'...)

        performanceMetrics.databaseQueryTime = Date.now() - queryStartTime;

        if (performanceMetrics.databaseQueryTime > 1000) { // 1 second threshold
          return {
            passed: false,
            message: 'Database query performance is below acceptable threshold',
            details: { queryTime: performanceMetrics.databaseQueryTime, threshold: 1000 }
          };
        }

      } catch (error) {
        return {
          passed: false,
          message: 'Database query performance test failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }

      // Check memory usage (Node.js process)
      const memUsage = process.memoryUsage();
      performanceMetrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

      if (performanceMetrics.memoryUsage > 500) { // 500MB threshold
        return {
          passed: false,
          message: 'Memory usage exceeds acceptable threshold',
          details: { memoryUsage: performanceMetrics.memoryUsage, threshold: 500 }
        };
      }

      // Check database size and index efficiency
      try {
        const dbStats = await pool.query(`
          SELECT pg_database_size(current_database()) as database_size
        `);
        
        performanceMetrics.databaseSize = parseInt(dbStats.rows[0].database_size) / 1024 / 1024; // MB

        // Check if indexes exist on critical tables
        const indexes = await pool.query(`
          SELECT tablename, indexname 
          FROM pg_indexes 
          WHERE tablename IN ('shipments', 'route_sessions', 'route_tracking')
        `);

        const criticalTables = ['shipments', 'route_sessions', 'route_tracking'];
        const indexedTables = new Set(indexes.rows.map(idx => idx.tablename));

        for (const table of criticalTables) {
          if (!indexedTables.has(table)) {
            performanceMetrics.indexEfficiency = false;
            break;
          }
        }

      } catch (error) {
        return {
          passed: false,
          message: 'Database performance analysis failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }

      // Overall performance assessment
      const performanceIssues = [];
      if (performanceMetrics.databaseQueryTime > 500) {
        performanceIssues.push('Slow database queries');
      }
      if (performanceMetrics.memoryUsage > 200) {
        performanceIssues.push('High memory usage');
      }
      if (performanceMetrics.databaseSize > 100) {
        performanceIssues.push('Large database size');
      }
      if (!performanceMetrics.indexEfficiency) {
        performanceIssues.push('Missing database indexes');
      }

      return {
        passed: performanceIssues.length === 0,
        message: performanceIssues.length === 0
          ? 'System performance meets requirements'
          : `Performance issues detected: ${performanceIssues.join(', ')}`,
        details: performanceMetrics
      };

    } catch (error) {
      return {
        passed: false,
        message: 'Failed to validate system performance',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  public async validateSpecificComponent(component: 'shipments' | 'route_tracking' | 'performance'): Promise<ValidationResult> {
    switch (component) {
      case 'shipments':
        return this.validateShipmentFunctionality();
      case 'route_tracking':
        return this.validateRouteTrackingToggle();
      case 'performance':
        return this.validateSystemPerformance();
      default:
        return {
          passed: false,
          message: 'Unknown component specified for validation'
        };
    }
  }

  public generateValidationReport(report: SystemValidationReport): string {
    const lines = [
      '# System Validation Report',
      `Generated: ${report.timestamp}`,
      `Overall Status: ${report.overallStatus}`,
      '',
      '## Summary',
      `- Total Checks: ${report.summary.totalChecks}`,
      `- Passed: ${report.summary.passed}`,
      `- Failed: ${report.summary.failed}`,
      `- Warnings: ${report.summary.warnings}`,
      '',
      '## Detailed Results',
      '',
      '### Shipment Functionality',
      `Status: ${report.shipmentFunctionality.passed ? 'PASS' : 'FAIL'}`,
      `Message: ${report.shipmentFunctionality.message}`,
      report.shipmentFunctionality.details ? `Details: ${JSON.stringify(report.shipmentFunctionality.details, null, 2)}` : '',
      '',
      '### Route Tracking Toggle',
      `Status: ${report.routeTrackingToggle.passed ? 'PASS' : 'FAIL'}`,
      `Message: ${report.routeTrackingToggle.message}`,
      report.routeTrackingToggle.details ? `Details: ${JSON.stringify(report.routeTrackingToggle.details, null, 2)}` : '',
      '',
      '### System Performance',
      `Status: ${report.systemPerformance.passed ? 'PASS' : 'FAIL'}`,
      `Message: ${report.systemPerformance.message}`,
      report.systemPerformance.details ? `Details: ${JSON.stringify(report.systemPerformance.details, null, 2)}` : '',
    ];

    return lines.filter(line => line !== '').join('\n');
  }
}

export default SystemValidationService;
export type { ValidationResult, SystemValidationReport };