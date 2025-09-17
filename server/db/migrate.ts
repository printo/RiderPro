import { liveDb, replicaDb } from './connection.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

class MigrationRunner {
  private db: any;
  private migrationsPath: string;

  constructor(database: any) {
    this.db = database;
    this.migrationsPath = join(__dirname, 'migrations');
  }

  // Initialize migrations table
  private initMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  // Get executed migrations
  private getExecutedMigrations(): string[] {
    const result = this.db.prepare('SELECT id FROM migrations ORDER BY executed_at').all();
    return result.map((row: any) => row.id);
  }

  // Load migration files
  private loadMigrations(): Migration[] {
    const fs = require('fs');
    const migrations: Migration[] = [];

    try {
      const files = fs.readdirSync(this.migrationsPath)
        .filter((file: string) => file.endsWith('.sql'))
        .sort();

      for (const filename of files) {
        const id = filename.replace('.sql', '');
        const filepath = join(this.migrationsPath, filename);
        const sql = readFileSync(filepath, 'utf8');

        migrations.push({ id, filename, sql });
      }
    } catch (error) {
      console.warn('Migrations directory not found or empty:', this.migrationsPath);
    }

    return migrations;
  }

  // Execute a single migration
  private executeMigration(migration: Migration): void {
    console.log(`Executing migration: ${migration.filename}`);

    try {
      // Execute the migration SQL
      this.db.exec(migration.sql);

      // Record the migration as executed
      this.db.prepare('INSERT INTO migrations (id, filename) VALUES (?, ?)').run(
        migration.id,
        migration.filename
      );

      console.log(`✅ Migration ${migration.filename} executed successfully`);
    } catch (error) {
      console.error(`❌ Failed to execute migration ${migration.filename}:`, error);
      throw error;
    }
  }

  // Run all pending migrations
  public runMigrations(): void {
    console.log('🚀 Starting database migrations...');

    this.initMigrationsTable();

    const executedMigrations = this.getExecutedMigrations();
    const allMigrations = this.loadMigrations();

    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      this.executeMigration(migration);
    }

    console.log('🎉 All migrations completed successfully');
  }

  // Get migration status
  public getMigrationStatus(): { executed: string[], pending: string[] } {
    this.initMigrationsTable();

    const executedMigrations = this.getExecutedMigrations();
    const allMigrations = this.loadMigrations();

    const pendingMigrations = allMigrations
      .filter(migration => !executedMigrations.includes(migration.id))
      .map(migration => migration.id);

    return {
      executed: executedMigrations,
      pending: pendingMigrations
    };
  }
}

// Run migrations on both databases
export function runMigrations(): void {
  console.log('Running migrations on live database...');
  const liveMigrator = new MigrationRunner(liveDb);
  liveMigrator.runMigrations();

  console.log('\nRunning migrations on replica database...');
  const replicaMigrator = new MigrationRunner(replicaDb);
  replicaMigrator.runMigrations();
}

// Get migration status for both databases
export function getMigrationStatus(): { live: any, replica: any } {
  const liveMigrator = new MigrationRunner(liveDb);
  const replicaMigrator = new MigrationRunner(replicaDb);

  return {
    live: liveMigrator.getMigrationStatus(),
    replica: replicaMigrator.getMigrationStatus()
  };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'run':
      runMigrations();
      break;
    case 'status':
      const status = getMigrationStatus();
      console.log('Migration Status:');
      console.log('Live DB:', status.live);
      console.log('Replica DB:', status.replica);
      break;
    default:
      console.log('Usage: npm run migrate [run|status]');
      console.log('  run    - Execute pending migrations');
      console.log('  status - Show migration status');
  }
}