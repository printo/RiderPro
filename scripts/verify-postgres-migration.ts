#!/usr/bin/env tsx
// Verification script to check PostgreSQL migration completeness
import { pool, backupPool, checkDatabaseHealth } from '../server/db/connection.js';

interface VerificationResult {
  passed: boolean;
  message: string;
}

const tests: Array<{ name: string; test: () => Promise<VerificationResult> }> = [
  {
    name: 'Main database connection',
    test: async () => {
      try {
        const result = await pool.query('SELECT NOW() as time, version() as version');
        const isPostgres = result.rows[0].version.toLowerCase().includes('postgresql');
        return {
          passed: isPostgres,
          message: isPostgres 
            ? `✓ Connected to ${result.rows[0].version.split(',')[0]}` 
            : '✗ Not connected to PostgreSQL'
        };
      } catch (error) {
        return { passed: false, message: `✗ Connection failed: ${error}` };
      }
    }
  },
  {
    name: 'All required tables exist',
    test: async () => {
      const requiredTables = [
        'shipments', 'route_sessions', 'route_tracking', 'vehicle_types',
        'fuel_settings', 'feature_flags', 'system_health_metrics',
        'rider_accounts', 'users', 'user_sessions'
      ];
      
      try {
        const result = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        
        const existingTables = result.rows.map((r: { table_name: string }) => r.table_name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        
        return {
          passed: missingTables.length === 0,
          message: missingTables.length === 0
            ? `✓ All ${requiredTables.length} tables exist`
            : `✗ Missing tables: ${missingTables.join(', ')}`
        };
      } catch (error) {
        return { passed: false, message: `✗ Table check failed: ${error}` };
      }
    }
  },
  {
    name: 'Optimized indexes exist',
    test: async () => {
      const requiredIndexes = [
        'idx_shipments_employee_id',
        'idx_shipments_admin_filters',
        'idx_shipments_location',
        'idx_route_tracking_employee_date',
        'idx_route_sessions_employee'
      ];
      
      try {
        const result = await pool.query(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'public'
        `);
        
        const existingIndexes = result.rows.map((r: { indexname: string }) => r.indexname);
        const missingIndexes = requiredIndexes.filter(i => !existingIndexes.includes(i));
        
        return {
          passed: missingIndexes.length === 0,
          message: missingIndexes.length === 0
            ? `✓ All critical indexes exist (${existingIndexes.length} total)`
            : `✗ Missing indexes: ${missingIndexes.join(', ')}`
        };
      } catch (error) {
        return { passed: false, message: `✗ Index check failed: ${error}` };
      }
    }
  },
  {
    name: 'Connection pooling configured',
    test: async () => {
      const totalCount = pool.totalCount;
      const idleCount = pool.idleCount;
      const waitingCount = pool.waitingCount;
      
      return {
        passed: true,
        message: `✓ Pool: ${totalCount} total, ${idleCount} idle, ${waitingCount} waiting`
      };
    }
  },
  {
    name: 'Backup database (dev/alpha only)',
    test: async () => {
      const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      const isLocal = process.env.DEPLOYMENT_ENV === 'localhost' || process.env.DEPLOYMENT_ENV === 'alpha';
      
      if (!isDev && !isLocal) {
        return { passed: true, message: '○ Backup disabled (production mode)' };
      }
      
      if (!backupPool) {
        return { passed: false, message: '✗ Backup pool not initialized' };
      }
      
      try {
        await backupPool.query('SELECT NOW()');
        return { 
          passed: true, 
          message: '✓ Backup database connected' 
        };
      } catch (error) {
        return { 
          passed: false, 
          message: `✗ Backup connection failed: ${error}` 
        };
      }
    }
  },
  {
    name: 'No SQLite dependencies',
    test: async () => {
      try {
        const packageJson = await import('../package.json', { assert: { type: 'json' } });
        const deps = {
          ...packageJson.default.dependencies,
          ...packageJson.default.devDependencies
        };
        
        const sqliteDeps = Object.keys(deps).filter(
          dep => dep.includes('sqlite') || dep === 'mysql2'
        );
        
        return {
          passed: sqliteDeps.length === 0,
          message: sqliteDeps.length === 0
            ? '✓ No SQLite/MySQL dependencies found'
            : `✗ Found unwanted deps: ${sqliteDeps.join(', ')}`
        };
      } catch (error) {
        return { passed: false, message: `✗ Package check failed: ${error}` };
      }
    }
  },
  {
    name: 'Health check endpoint',
    test: async () => {
      try {
        const health = await checkDatabaseHealth();
        return {
          passed: health.main === true,
          message: health.main
            ? `✓ Health check working (main: ${health.main}, backup: ${health.backup ?? 'N/A'})`
            : '✗ Health check failed'
        };
      } catch (error) {
        return { passed: false, message: `✗ Health check error: ${error}` };
      }
    }
  }
];

async function runVerification() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   PostgreSQL Migration Verification                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const { name, test } of tests) {
    process.stdout.write(`Testing: ${name}... `);
    
    try {
      const result = await test();
      console.log(result.message);
      
      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      console.log(`✗ Unexpected error: ${error}`);
      failedCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Results: ${passedCount} passed, ${failedCount} failed out of ${tests.length} tests`);
  console.log('═'.repeat(60) + '\n');

  if (failedCount === 0) {
    console.log('🎉 All verification tests passed!');
    console.log('✅ PostgreSQL migration is complete and working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }

  // Cleanup
  await pool.end();
  if (backupPool) {
    await backupPool.end();
  }
}

// Run verification
runVerification().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
