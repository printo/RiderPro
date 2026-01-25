import { pool, backupPool, initTables, initBackupDatabase } from './connection.js';
import { log } from "../../shared/utils/logger.js";
import { PoolClient } from 'pg';

interface Migration {
  version: number;
  name: string;
  up: (client: PoolClient) => Promise<void>;
  down: (client: PoolClient) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (_client) => {
      // For Main DB, initTables creates the full schema
      log.info('Migration 1: Initializing Main DB Schema...');
      await initTables();
    },
    down: async (client) => {
      await client.query('DROP TABLE IF EXISTS user_sessions CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      await client.query('DROP TABLE IF EXISTS rider_accounts CASCADE');
      await client.query('DROP TABLE IF EXISTS system_health_metrics CASCADE');
      await client.query('DROP TABLE IF EXISTS feature_flags CASCADE');
      await client.query('DROP TABLE IF EXISTS fuel_settings CASCADE');
      await client.query('DROP TABLE IF EXISTS vehicle_types CASCADE');
      await client.query('DROP TABLE IF EXISTS route_tracking CASCADE');
      await client.query('DROP TABLE IF EXISTS route_sessions CASCADE');
      await client.query('DROP TABLE IF EXISTS shipments CASCADE');
    }
  }
];

export const createMigrationTable = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log.info('✓ Migration tracking table created');
  } catch (error) {
    log.error('Failed to create migration table', error);
    throw error;
  } finally {
    client.release();
  }
};

export const getAppliedMigrations = async (): Promise<number[]> => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    return result.rows.map(row => row.version);
  } catch (error) {
    log.error('Failed to get applied migrations', error);
    return [];
  } finally {
    client.release();
  }
};

export const applyMigration = async (migration: Migration) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    log.info(`Applying migration ${migration.version}: ${migration.name}`);
    await migration.up(client);
    
    await client.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );
    
    await client.query('COMMIT');
    log.info(`✓ Migration ${migration.version} applied successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    log.error(`Failed to apply migration ${migration.version}`, error);
    throw error;
  } finally {
    client.release();
  }
};

export const rollbackMigration = async (migration: Migration) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    log.info(`Rolling back migration ${migration.version}: ${migration.name}`);
    await migration.down(client);
    
    await client.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [migration.version]
    );
    
    await client.query('COMMIT');
    log.info(`✓ Migration ${migration.version} rolled back successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    log.error(`Failed to rollback migration ${migration.version}`, error);
    throw error;
  } finally {
    client.release();
  }
};

export const runMigrations = async () => {
  try {
    log.info('Starting migration process...');
    
    // 1. Migrate Main Database
    log.info('--- Checking Main Database ---');
    await createMigrationTable();
    const applied = await getAppliedMigrations();
    
    log.info(`Found ${applied.length} applied migrations`);
    
    for (const migration of migrations) {
      if (!applied.includes(migration.version)) {
        await applyMigration(migration);
      } else {
        log.info(`Migration ${migration.version} already applied, skipping`);
      }
    }
    log.info('✓ Main Database migrations completed successfully');

    // 2. Initialize Backup Database (if available)
    if (backupPool) {
      log.info('--- Checking Backup Database ---');
      try {
        await initBackupDatabase();
        log.info('✓ Backup Database initialized successfully');
      } catch (error) {
        log.warn('Failed to initialize Backup Database (it might not be available or needed)', error);
      }
    } else {
        log.info('--- Backup Database not configured, skipping ---');
    }

  } catch (error) {
    log.error('Migration process failed', error);
    throw error;
  }
};

export const runMigrationRollback = async (targetVersion?: number) => {
  try {
    log.info('Starting rollback process...');
    
    const applied = await getAppliedMigrations();
    const toRollback = migrations
      .filter(m => applied.includes(m.version))
      .filter(m => !targetVersion || m.version > targetVersion)
      .sort((a, b) => b.version - a.version);
    
    for (const migration of toRollback) {
      await rollbackMigration(migration);
    }
    
    log.info('✓ Rollback completed successfully');
  } catch (error) {
    log.error('Rollback process failed', error);
    throw error;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  (async () => {
    try {
      if (command === 'up') {
        await runMigrations();
      } else if (command === 'down') {
        const version = process.argv[3] ? parseInt(process.argv[3]) : undefined;
        await runMigrationRollback(version);
      } else {
        console.log('Usage:');
        console.log('  npm run migrate up        - Apply all pending migrations');
        console.log('  npm run migrate down [v]  - Rollback to version v (or all if not specified)');
      }
      process.exit(0);
    } catch {
      process.exit(1);
    }
  })();
}
