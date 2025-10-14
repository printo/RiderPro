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
    // Migration 001: Initial route tracking schema
    this.migrations.push({
      id: '001_initial_route_tracking',
      version: 1,
      description: 'Create initial route tracking tables',
      createdAt: '2024-01-01T00:00:00Z',
      up: (db: Database) => {
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

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_route_sessions_employee 
            ON route_sessions(employee_id);
          CREATE INDEX IF NOT EXISTS idx_route_sessions_status 
            ON route_sessions(status);
          CREATE INDEX IF NOT EXISTS idx_route_sessions_start_time 
            ON route_sessions(start_time);
          
          CREATE INDEX IF NOT EXISTS idx_route_tracking_session 
            ON route_tracking(session_id);
          CREATE INDEX IF NOT EXISTS idx_route_tracking_employee 
            ON route_tracking(employee_id);
          CREATE INDEX IF NOT EXISTS idx_route_tracking_date 
            ON route_tracking(date);
          CREATE INDEX IF NOT EXISTS idx_route_tracking_timestamp 
            ON route_tracking(timestamp);
        `);
      },
      down: (db: Database) => {
        db.exec(`
          DROP INDEX IF EXISTS idx_route_tracking_timestamp;
          DROP INDEX IF EXISTS idx_route_tracking_date;
          DROP INDEX IF EXISTS idx_route_tracking_employee;
          DROP INDEX IF EXISTS idx_route_tracking_session;
          DROP INDEX IF EXISTS idx_route_sessions_start_time;
          DROP INDEX IF EXISTS idx_route_sessions_status;
          DROP INDEX IF EXISTS idx_route_sessions_employee;
          DROP TABLE IF EXISTS route_tracking;
          DROP TABLE IF EXISTS route_sessions;
        `);
      }
    });

    // Migration 002: Add authentication and security tables
    this.migrations.push({
      id: '002_authentication_security',
      version: 2,
      description: 'Add user authentication and security tables',
      createdAt: '2024-01-02T00:00:00Z',
      up: (db: Database) => {
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
            last_login TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          -- User sessions table
          CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id)
          );

          -- Audit logs table
          CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            user_id TEXT,
            username TEXT,
            employee_id TEXT,
            resource_type TEXT,
            resource_id TEXT,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            user_agent TEXT,
            timestamp TEXT DEFAULT (datetime('now')),
            success BOOLEAN NOT NULL,
            error_message TEXT
          );

          -- Indexes
          CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
          CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
          CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_employee_id ON audit_logs(employee_id);
        `);
      },
      down: (db: Database) => {
        db.exec(`
          DROP INDEX IF EXISTS idx_audit_logs_employee_id;
          DROP INDEX IF EXISTS idx_audit_logs_event_type;
          DROP INDEX IF EXISTS idx_audit_logs_user_id;
          DROP INDEX IF EXISTS idx_audit_logs_timestamp;
          DROP INDEX IF EXISTS idx_user_sessions_expires_at;
          DROP INDEX IF EXISTS idx_user_sessions_user_id;
          DROP INDEX IF EXISTS idx_users_employee_id;
          DROP INDEX IF EXISTS idx_users_email;
          DROP INDEX IF EXISTS idx_users_username;
          DROP TABLE IF EXISTS audit_logs;
          DROP TABLE IF EXISTS user_sessions;
          DROP TABLE IF EXISTS users;
        `);
      }
    });

    // Migration 003: Add privacy and consent management
    this.migrations.push({
      id: '003_privacy_consent',
      version: 3,
      description: 'Add privacy settings and consent management',
      createdAt: '2024-01-03T00:00:00Z',
      up: (db: Database) => {
        db.exec(`
          -- Privacy settings table
          CREATE TABLE IF NOT EXISTS privacy_settings (
            employee_id TEXT PRIMARY KEY,
            gps_tracking_consent BOOLEAN DEFAULT 0,
            data_analytics_consent BOOLEAN DEFAULT 0,
            data_export_consent BOOLEAN DEFAULT 0,
            performance_monitoring_consent BOOLEAN DEFAULT 0,
            data_retention_days INTEGER DEFAULT 90,
            anonymize_after_days INTEGER,
            consent_date TEXT,
            last_updated TEXT DEFAULT (datetime('now')),
            ip_address TEXT,
            consent_version TEXT DEFAULT '1.0'
          );

          -- Data anonymization rules table
          CREATE TABLE IF NOT EXISTS data_anonymization_rules (
            id TEXT PRIMARY KEY,
            table_name TEXT NOT NULL,
            column_name TEXT NOT NULL,
            anonymization_type TEXT NOT NULL,
            replacement_value TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
          );

          -- Data processing log table
          CREATE TABLE IF NOT EXISTS data_processing_log (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            processing_type TEXT NOT NULL,
            data_types TEXT,
            purpose TEXT,
            legal_basis TEXT,
            processed_at TEXT DEFAULT (datetime('now')),
            processed_by TEXT
          );

          -- Indexes
          CREATE INDEX IF NOT EXISTS idx_privacy_settings_employee_id 
            ON privacy_settings(employee_id);
          CREATE INDEX IF NOT EXISTS idx_data_anonymization_rules_table 
            ON data_anonymization_rules(table_name);
          CREATE INDEX IF NOT EXISTS idx_data_processing_log_employee_id 
            ON data_processing_log(employee_id);
          CREATE INDEX IF NOT EXISTS idx_data_processing_log_processed_at 
            ON data_processing_log(processed_at);
        `);
      },
      down: (db: Database) => {
        db.exec(`
          DROP INDEX IF EXISTS idx_data_processing_log_processed_at;
          DROP INDEX IF EXISTS idx_data_processing_log_employee_id;
          DROP INDEX IF EXISTS idx_data_anonymization_rules_table;
          DROP INDEX IF EXISTS idx_privacy_settings_employee_id;
          DROP TABLE IF EXISTS data_processing_log;
          DROP TABLE IF EXISTS data_anonymization_rules;
          DROP TABLE IF EXISTS privacy_settings;
        `);
      }
    });

    // Migration 004: Add configuration and feature flags
    this.migrations.push({
      id: '004_configuration_features',
      version: 4,
      description: 'Add system configuration and feature flags',
      createdAt: '2024-01-04T00:00:00Z',
      up: (db: Database) => {
        db.exec(`
          -- System configuration table
          CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'string',
            description TEXT,
            category TEXT DEFAULT 'general',
            is_sensitive BOOLEAN DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            updated_by TEXT
          );

          -- Feature flags table
          CREATE TABLE IF NOT EXISTS feature_flags (
            name TEXT PRIMARY KEY,
            enabled BOOLEAN NOT NULL DEFAULT 0,
            description TEXT,
            rollout_percentage INTEGER DEFAULT 0,
            target_users TEXT,
            target_roles TEXT,
            start_date TEXT,
            end_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            updated_by TEXT
          );

          -- System health metrics table
          CREATE TABLE IF NOT EXISTS system_health_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_name TEXT NOT NULL,
            metric_value REAL NOT NULL,
            metric_unit TEXT,
            threshold_value REAL,
            status TEXT NOT NULL,
            timestamp TEXT DEFAULT (datetime('now')),
            details TEXT
          );

          -- Indexes
          CREATE INDEX IF NOT EXISTS idx_system_config_category 
            ON system_config(category);
          CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled 
            ON feature_flags(enabled);
          CREATE INDEX IF NOT EXISTS idx_system_health_metrics_timestamp 
            ON system_health_metrics(timestamp);
          CREATE INDEX IF NOT EXISTS idx_system_health_metrics_name 
            ON system_health_metrics(metric_name);
        `);
      },
      down: (db: Database) => {
        db.exec(`
          DROP INDEX IF EXISTS idx_system_health_metrics_name;
          DROP INDEX IF EXISTS idx_system_health_metrics_timestamp;
          DROP INDEX IF EXISTS idx_feature_flags_enabled;
          DROP INDEX IF EXISTS idx_system_config_category;
          DROP TABLE IF EXISTS system_health_metrics;
          DROP TABLE IF EXISTS feature_flags;
          DROP TABLE IF EXISTS system_config;
        `);
      }
    });

    // Migration 005: Add external integration fields to shipments table
    this.migrations.push({
      id: '005_shipments_external_integration',
      version: 5,
      description: 'Add missing fields for external system integration to shipments table',
      createdAt: '2024-01-05T00:00:00Z',
      up: (db: Database) => {
        // Check which columns already exist to avoid errors
        const tableInfo = db.prepare("PRAGMA table_info(shipments)").all();
        const existingColumns = new Set(tableInfo.map((col: any) => col.name));

        // Add missing columns one by one
        if (!existingColumns.has('priority')) {
          db.exec('ALTER TABLE shipments ADD COLUMN priority TEXT');
        }

        if (!existingColumns.has('pickupAddress')) {
          db.exec('ALTER TABLE shipments ADD COLUMN pickupAddress TEXT');
        }

        if (!existingColumns.has('weight')) {
          db.exec('ALTER TABLE shipments ADD COLUMN weight REAL');
        }

        if (!existingColumns.has('dimensions')) {
          db.exec('ALTER TABLE shipments ADD COLUMN dimensions TEXT');
        }

        if (!existingColumns.has('specialInstructions')) {
          db.exec('ALTER TABLE shipments ADD COLUMN specialInstructions TEXT');
        }

        if (!existingColumns.has('actualDeliveryTime')) {
          db.exec('ALTER TABLE shipments ADD COLUMN actualDeliveryTime TEXT');
        }

        // Create indexes for external integration fields
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_shipments_priority ON shipments(priority);
          CREATE INDEX IF NOT EXISTS idx_shipments_pickup_address ON shipments(pickupAddress);
          CREATE INDEX IF NOT EXISTS idx_shipments_weight ON shipments(weight);
          CREATE INDEX IF NOT EXISTS idx_shipments_actual_delivery ON shipments(actualDeliveryTime);
        `);
      },
      down: (db: Database) => {
        // SQLite doesn't support DROP COLUMN, so we would need to recreate the table
        // For now, we'll just drop the indexes in the rollback
        db.exec(`
          DROP INDEX IF EXISTS idx_shipments_actual_delivery;
          DROP INDEX IF EXISTS idx_shipments_weight;
          DROP INDEX IF EXISTS idx_shipments_pickup_address;
          DROP INDEX IF EXISTS idx_shipments_priority;
        `);

        // Note: In a production environment, you would recreate the table without these columns
        // This is a simplified rollback that only removes indexes
        console.log('Warning: Column removal not implemented in rollback. Only indexes were dropped.');
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

    console.log(`Found ${pending.length} pending migrations`);

    for (const migration of pending) {
      const startTime = Date.now();

      try {
        console.log(`Running migration ${migration.version}: ${migration.description}`);

        // Start transaction
        const transaction = this.db.transaction(() => {
          // Execute migration
          migration.up(this.db);

          // Record migration
          const executionTime = Date.now() - startTime;
          const checksum = this.calculateChecksum(migration);

          this.db.prepare(`
            INSERT INTO schema_migrations 
            (id, version, description, executed_at, execution_time_ms, checksum)
            VALUES (?, ?, ?, datetime('now'), ?, ?)
          `).run(
            migration.id,
            migration.version,
            migration.description,
            executionTime,
            checksum
          );
        });

        transaction();
        executed++;

        console.log(`✓ Migration ${migration.version} completed in ${Date.now() - startTime}ms`);
      } catch (error) {
        const errorMsg = `Migration ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`✗ ${errorMsg}`);
        errors.push(errorMsg);

        // Stop on first error to maintain consistency
        break;
      }
    }

    return {
      success: errors.length === 0,
      executed,
      errors
    };
  }

  public async rollbackMigration(version: number): Promise<{ success: boolean; error?: string }> {
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
      const executedMigration = executed.find(e => e.version === m.version);
      return {
        version: m.version,
        description: m.description,
        status: executedVersions.has(m.version) ? 'executed' as const : 'pending' as const,
        executedAt: executedMigration?.executed_at,
        executionTime: executedMigration?.execution_time_ms
      };
    });

    return {
      total: this.migrations.length,
      executed: executed.length,
      pending: this.migrations.length - executed.length,
      latest: executed.length > 0 ? Math.max(...executed.map(m => m.version)) : null,
      migrations
    };
  }

  public initializeDefaultData(): void {
    // This method can be used to initialize default data after migrations
    // Currently no default data is needed for the shipments table
    console.log('✅ Default data initialization completed');
  }
}


export default MigrationManager;