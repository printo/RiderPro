#!/usr/bin/env tsx

/**
 * Manual migration runner script
 * Usage: npx tsx server/scripts/run-migrations.ts
 */

import Database from 'better-sqlite3';
import MigrationManager from '../migrations/index.js';
import config from '../config/index.js';
import fs from 'fs';
import path from 'path';
import { log } from "../../shared/utils/logger.js";

async function runMigrations() {
  log.dev('🔄 Running database migrations...');

  try {
    // Ensure database directory exists
    const dbPath = config.database.path;
    if (dbPath !== ':memory:') {
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        log.dev(`Created database directory: ${dbDir}`);
      }
    }

    const db = new Database(dbPath);

    // Configure database for optimal performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 10000');
    db.pragma('temp_store = MEMORY');

    // Initialize basic tables first (from connection.ts)
    log.dev('Initializing basic tables...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS shipments (
        id TEXT PRIMARY KEY,
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
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);

    // Acknowledgments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS acknowledgments (
        id TEXT PRIMARY KEY,
        shipmentId TEXT NOT NULL,
        signatureUrl TEXT,
        photoUrl TEXT,
        acknowledgment_captured_at TEXT NOT NULL,
        FOREIGN KEY (shipmentId) REFERENCES shipments (id)
      )
    `);

    // Sync status tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_status (
        id TEXT PRIMARY KEY,
        shipmentId TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')),
        attempts INTEGER DEFAULT 0,
        lastAttempt TEXT,
        error TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (shipmentId) REFERENCES shipments (id)
      )
    `);

    // Create basic indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
      CREATE INDEX IF NOT EXISTS idx_shipments_type ON shipments(type);
      CREATE INDEX IF NOT EXISTS idx_shipments_route ON shipments(routeName);
      CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(deliveryTime);
      CREATE INDEX IF NOT EXISTS idx_acknowledgments_shipment ON acknowledgments(shipmentId);
      CREATE INDEX IF NOT EXISTS idx_sync_status_shipment ON sync_status(shipmentId);
      CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status);
    `);

    log.dev('✅ Basic tables initialized');

    const migrationManager = new MigrationManager(db);

    // Show current status
    const status = migrationManager.getMigrationStatus();
    log.dev(`\nMigration Status:`);
    log.dev(`- Total migrations: ${status.total}`);
    log.dev(`- Executed: ${status.executed}`);
    log.dev(`- Pending: ${status.pending}`);
    log.dev(`- Latest version: ${status.latest || 'None'}`);

    if (status.pending > 0) {
      log.dev(`\nPending migrations:`);
      status.migrations
        .filter(m => m.status === 'pending')
        .forEach(m => log.dev(`  - ${m.version}: ${m.description}`));

      // Run migrations
      const result = await migrationManager.runMigrations();

      if (result.success) {
        log.dev(`\n✅ ${result.executed} migrations executed successfully`);
      } else {
        console.error(`\n❌ Migration failed:`, result.errors);
        process.exit(1);
      }
    } else {
      log.dev('\n✅ All migrations are up to date');
    }

    db.close();
    log.dev('\n🎉 Migration process completed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export default runMigrations;