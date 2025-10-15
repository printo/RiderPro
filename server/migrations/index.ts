import { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

// Migration interface
interface Migration {
  id: string;
  version: number;
  description: string;
  up: (db: Database) => void;
  down: (db: Database) => void;
  createdAt: string;
}

// Migration status
interface MigrationRecord {
  id: string;
  version: number;
  description: string;
  executed_at: string;
  execution_time_ms: number;
  checksum: string;
}

class MigrationManager {
  private db: Database;
  private migrations: Migration[] = [];

  constructor(database: Database) {
    this.db = database;
    this.initializeMigrationTable();
    this.loadMigrations();
  }

  private initializeMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        description TEXT NOT NULL,
        executed_at TEXT NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        checksum TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
      ON schema_migrations(version);
    `);
  }

  private loadMigrations(): void {
    // Single comprehensive migration
    this.migrations.push({
      id: '001_complete_schema',
      version: 1,
      description: 'Create complete RiderPro database schema with all tables and indexes',
      createdAt: '2024-01-01T00:00:00Z',
      up: (db: Database) => {
        // Route tracking tables
        db.exec(`
          -- Route sessions table
          CREATE TABLE IF NOT EXISTS route_sessions (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            start_latitude REAL NOT NULL,
            start_longitude REAL NOT NULL,
            end_latitude REAL,
            end_longitude REAL,
            total_distance REAL DEFAULT 0,
            total_time INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          -- GPS coordinates table
          CREATE TABLE IF NOT EXISTS route_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            employee_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timestamp TEXT NOT NULL,
            accuracy REAL,
            speed REAL,
            event_type TEXT DEFAULT 'gps',
            shipment_id TEXT,
            date TEXT NOT NULL,
            fuel_efficiency REAL DEFAULT 15.0,
            fuel_price REAL DEFAULT 1.5,
            FOREIGN KEY (session_id) REFERENCES route_sessions (id)
          );
        `);

        // User authentication table (simplified - no API tokens)
        db.exec(`
          -- Users table
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            employee_id TEXT,
            is_active BOOLEAN DEFAULT 1,
            is_super_user BOOLEAN DEFAULT 0,
            is_ops_team BOOLEAN DEFAULT 0,
            last_login TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `);

        // Add missing columns to existing tables (ignore if they already exist)
        try {
          db.exec(`ALTER TABLE users ADD COLUMN is_super_user BOOLEAN DEFAULT 0;`);
        } catch (e) {
          // Column already exists, ignore
        }
        try {
          db.exec(`ALTER TABLE users ADD COLUMN is_ops_team BOOLEAN DEFAULT 0;`);
        } catch (e) {
          // Column already exists, ignore
        }

        // Create consolidated shipments table with all fields
        db.exec(`
          CREATE TABLE IF NOT EXISTS shipments (
            shipment_id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK(type IN ('delivery', 'pickup')),
            customerName TEXT NOT NULL,
            customerMobile TEXT NOT NULL,
            address TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            cost REAL NOT NULL,
            deliveryTime TEXT NOT NULL,
            routeName TEXT NOT NULL,
            employeeId TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Assigned' CHECK(status IN ('Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled')),
            priority TEXT DEFAULT 'medium',
            pickupAddress TEXT,
            weight REAL DEFAULT 0,
            dimensions TEXT,
            specialInstructions TEXT,
            expectedDeliveryTime TEXT,
            -- Tracking fields
            start_latitude REAL,
            start_longitude REAL,
            stop_latitude REAL,
            stop_longitude REAL,
            km_travelled REAL DEFAULT 0,
            -- Acknowledgment fields (merged from acknowledgments table)
            signatureUrl TEXT,
            photoUrl TEXT,
            acknowledgment_captured_at TEXT,
            -- Sync tracking fields (merged from sync_status table)
            synced_to_external BOOLEAN DEFAULT 0,
            last_sync_attempt TEXT,
            sync_error TEXT,
            sync_attempts INTEGER DEFAULT 0,
            -- Timestamps
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
          );
        `);

        // System monitoring tables
        db.exec(`
          CREATE TABLE IF NOT EXISTS system_health_metrics (
            id TEXT PRIMARY KEY,
            metric_name TEXT NOT NULL,
            metric_value REAL NOT NULL,
            metric_unit TEXT,
            timestamp TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS feature_flags (
            id TEXT PRIMARY KEY,
            flag_name TEXT UNIQUE NOT NULL,
            flag_value BOOLEAN NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS system_config (
            id TEXT PRIMARY KEY,
            config_key TEXT UNIQUE NOT NULL,
            config_value TEXT NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `);

        // Create all indexes for performance
        db.exec(`
          -- Route tracking indexes
          CREATE INDEX IF NOT EXISTS idx_route_sessions_employee ON route_sessions(employee_id);
          CREATE INDEX IF NOT EXISTS idx_route_sessions_status ON route_sessions(status);
          CREATE INDEX IF NOT EXISTS idx_route_sessions_start_time ON route_sessions(start_time);
          CREATE INDEX IF NOT EXISTS idx_route_tracking_session ON route_tracking(session_id);
          CREATE INDEX IF NOT EXISTS idx_route_tracking_employee ON route_tracking(employee_id);
          CREATE INDEX IF NOT EXISTS idx_route_tracking_date ON route_tracking(date);
          CREATE INDEX IF NOT EXISTS idx_route_tracking_timestamp ON route_tracking(timestamp);

          -- User authentication indexes
          CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);

          -- Shipments indexes (consolidated table)
          CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
          CREATE INDEX IF NOT EXISTS idx_shipments_type ON shipments(type);
          CREATE INDEX IF NOT EXISTS idx_shipments_route ON shipments(routeName);
          CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(deliveryTime);
          CREATE INDEX IF NOT EXISTS idx_shipments_employee ON shipments(employeeId);
          CREATE INDEX IF NOT EXISTS idx_shipments_synced ON shipments(synced_to_external);
          CREATE INDEX IF NOT EXISTS idx_shipments_captured ON shipments(acknowledgment_captured_at);

          -- System monitoring indexes
          CREATE INDEX IF NOT EXISTS idx_health_metrics_name ON system_health_metrics(metric_name);
          CREATE INDEX IF NOT EXISTS idx_health_metrics_timestamp ON system_health_metrics(timestamp);
          CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);
          CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
        `);

        // Insert default data
        db.exec(`
          -- Insert default feature flags
          INSERT OR IGNORE INTO feature_flags (id, flag_name, flag_value, description) VALUES
          ('ff_001', 'enable_gps_tracking', 1, 'Enable GPS tracking for route sessions'),
          ('ff_002', 'enable_offline_sync', 1, 'Enable offline data synchronization'),
          ('ff_003', 'enable_analytics', 1, 'Enable route analytics and reporting'),
          ('ff_004', 'enable_external_sync', 1, 'Enable synchronization with external systems');

          -- Insert default system configuration
          INSERT OR IGNORE INTO system_config (id, config_key, config_value, description) VALUES
          ('cfg_001', 'max_route_sessions', '100', 'Maximum number of active route sessions per user'),
          ('cfg_002', 'gps_accuracy_threshold', '10', 'GPS accuracy threshold in meters'),
          ('cfg_003', 'sync_retry_attempts', '3', 'Number of retry attempts for failed syncs'),
          ('cfg_004', 'external_api_timeout', '30000', 'External API timeout in milliseconds');
        `);

        console.log('✅ Complete database schema created successfully');
      },
      down: (db: Database) => {
        console.log('🔄 Rolling back complete database schema...');

        // Drop all indexes first
        db.exec(`
          DROP INDEX IF EXISTS idx_system_config_key;
          DROP INDEX IF EXISTS idx_feature_flags_name;
          DROP INDEX IF EXISTS idx_health_metrics_timestamp;
          DROP INDEX IF EXISTS idx_health_metrics_name;
          DROP INDEX IF EXISTS idx_shipments_captured;
          DROP INDEX IF EXISTS idx_shipments_synced;
          DROP INDEX IF EXISTS idx_shipments_employee;
          DROP INDEX IF EXISTS idx_shipments_date;
          DROP INDEX IF EXISTS idx_shipments_route;
          DROP INDEX IF EXISTS idx_shipments_type;
          DROP INDEX IF EXISTS idx_shipments_status;
          DROP INDEX IF EXISTS idx_users_employee_id;
          DROP INDEX IF EXISTS idx_users_email;
          DROP INDEX IF EXISTS idx_users_username;
          DROP INDEX IF EXISTS idx_route_tracking_timestamp;
          DROP INDEX IF EXISTS idx_route_tracking_date;
          DROP INDEX IF EXISTS idx_route_tracking_employee;
          DROP INDEX IF EXISTS idx_route_tracking_session;
          DROP INDEX IF EXISTS idx_route_sessions_start_time;
          DROP INDEX IF EXISTS idx_route_sessions_status;
          DROP INDEX IF EXISTS idx_route_sessions_employee;
        `);

        // Drop all tables
        db.exec(`
          DROP TABLE IF EXISTS system_config;
          DROP TABLE IF EXISTS feature_flags;
          DROP TABLE IF EXISTS system_health_metrics;
          DROP TABLE IF EXISTS shipments;
          DROP TABLE IF EXISTS users;
          DROP TABLE IF EXISTS route_tracking;
          DROP TABLE IF EXISTS route_sessions;
        `);

        console.log('✅ Database schema rolled back successfully');
      }
    });

    // Sort migrations by version
    this.migrations.sort((a, b) => a.version - b.version);
  }

  private calculateChecksum(migration: Migration): string {
    const content = `${migration.id}-${migration.version}-${migration.description}`;
    // Simple checksum - in production, use a proper hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  public getExecutedMigrations(): MigrationRecord[] {
    return this.db.prepare(`
      SELECT * FROM schema_migrations 
      ORDER BY version ASC
    `).all() as MigrationRecord[];
  }

  public getPendingMigrations(): Migration[] {
    const executed = this.getExecutedMigrations();
    const executedVersions = new Set(executed.map(m => m.version));

    return this.migrations.filter(m => !executedVersions.has(m.version));
  }

  public async runMigrations(): Promise<{ success: boolean; executed: number; errors: string[] }> {
    const pending = this.getPendingMigrations();
    const errors: string[] = [];
    let executed = 0;

    console.log(`🔄 Running database migrations...`);
    console.log(`Found ${pending.length} pending migrations`);

    for (const migration of pending) {
      try {
        console.log(`Running migration ${migration.version}: ${migration.description}`);

        const startTime = Date.now();
        const transaction = this.db.transaction(() => {
          migration.up(this.db);

          // Record migration
          this.db.prepare(`
            INSERT INTO schema_migrations (id, version, description, executed_at, execution_time_ms, checksum)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            migration.id,
            migration.version,
            migration.description,
            new Date().toISOString(),
            Date.now() - startTime,
            this.calculateChecksum(migration)
          );
        });

        transaction();
        executed++;
        console.log(`✓ Migration ${migration.version} completed in ${Date.now() - startTime}ms`);
      } catch (error) {
        const errorMsg = `Migration ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`✗ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    if (errors.length > 0) {
      console.error(`❌ ${errors.length} migrations failed`);
      return { success: false, executed, errors };
    }

    console.log(`✅ ${executed} migrations executed successfully`);
    return { success: true, executed, errors: [] };
  }

  public rollbackMigration(version: number): { success: boolean; error?: string } {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration) {
      return { success: false, error: `Migration version ${version} not found` };
    }

    const executed = this.getExecutedMigrations();
    const executedMigration = executed.find(m => m.version === version);
    if (!executedMigration) {
      return { success: false, error: `Migration version ${version} has not been executed` };
    }

    try {
      console.log(`Rolling back migration ${version}: ${migration.description}`);

      const transaction = this.db.transaction(() => {
        // Execute rollback
        migration.down(this.db);

        // Remove migration record
        this.db.prepare(`
          DELETE FROM schema_migrations WHERE version = ?
        `).run(version);
      });

      transaction();

      console.log(`✓ Migration ${version} rolled back successfully`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Rollback of migration ${version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`✗ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  public getMigrationStatus(): {
    total: number;
    executed: number;
    pending: number;
    latest: number | null;
    migrations: Array<{
      version: number;
      description: string;
      status: 'executed' | 'pending';
      executedAt?: string;
      executionTime?: number;
    }>;
  } {
    const executed = this.getExecutedMigrations();
    const executedVersions = new Set(executed.map(m => m.version));

    const migrations = this.migrations.map(m => {
      const executedMigration = executed.find(em => em.version === m.version);
      return {
        version: m.version,
        description: m.description,
        status: executedVersions.has(m.version) ? 'executed' as const : 'pending' as const,
        executedAt: executedMigration?.executed_at,
        executionTime: executedMigration?.execution_time_ms
      };
    });

    const latest = executed.length > 0 ? Math.max(...executed.map(m => m.version)) : null;

    return {
      total: this.migrations.length,
      executed: executed.length,
      pending: this.migrations.length - executed.length,
      latest,
      migrations
    };
  }
}

export default MigrationManager;