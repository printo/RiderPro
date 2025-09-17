// Migration to remove password_hash column from users table
// This is needed when switching from local to external-only authentication

const Database = require('better-sqlite3');
const path = require('path');

const migrateRemovePasswordColumn = () => {
  try {
    const dbPath = process.env.DATABASE_PATH || './data/riderpro.db';
    const db = new Database(dbPath);

    console.log('🔄 Migrating database to remove password column...');

    // Check if password_hash column exists
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasPasswordColumn = tableInfo.some(col => col.name === 'password_hash');

    if (hasPasswordColumn) {
      console.log('📋 Found password_hash column, removing...');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.exec(`
        BEGIN TRANSACTION;
        
        -- Create new table without password_hash
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          employee_id TEXT,
          is_active BOOLEAN DEFAULT 1,
          last_login TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        
        -- Copy data from old table (excluding password_hash)
        INSERT INTO users_new (id, username, email, role, employee_id, is_active, last_login, created_at, updated_at)
        SELECT id, username, email, role, employee_id, is_active, last_login, created_at, updated_at
        FROM users;
        
        -- Drop old table and rename new one
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        
        COMMIT;
      `);

      console.log('✅ Successfully removed password column from users table');
    } else {
      console.log('✅ Password column not found, no migration needed');
    }

    db.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  migrateRemovePasswordColumn();
}

module.exports = { migrateRemovePasswordColumn };