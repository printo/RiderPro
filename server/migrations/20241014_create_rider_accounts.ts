import { Database } from 'better-sqlite3';

export const up = (db: Database) => {
  // Create rider_accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rider_accounts (
      id TEXT PRIMARY KEY,
      rider_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      is_super_user BOOLEAN DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT
    )
  `);

  // Create indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_rider_accounts_rider_id ON rider_accounts(rider_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_rider_accounts_email ON rider_accounts(email)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_rider_accounts_reset_token ON rider_accounts(reset_token)');
};

export const down = (db: Database) => {
  db.exec('DROP TABLE IF EXISTS rider_accounts');
};

export const description = 'Create rider_accounts table with authentication fields';
export const version = 1;
