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

    // Let MigrationManager handle all table creation and updates
    log.dev('MigrationManager taking over schema management...');

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