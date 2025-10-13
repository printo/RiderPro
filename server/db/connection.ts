import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'server/db');

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const liveDbPath = path.join(dbDir, 'sqlite.db');
const replicaDbPath = path.join(dbDir, 'replica_sqlite.db');

// In development, use replica DB for operations, in production use live DB
const isDevelopment = process.env.NODE_ENV === 'development';
export const liveDb = new Database(liveDbPath);
export const replicaDb = new Database(replicaDbPath);

// For dev mode, swap the usage so npm run dev uses replica
export const primaryDb = isDevelopment ? replicaDb : liveDb;
export const secondaryDb = isDevelopment ? liveDb : replicaDb;

// Initialize tables
const initTables = (db: Database.Database) => {
  // Shipments table
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
      capturedAt TEXT NOT NULL,
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

  // Create indexes for better performance (excluding location index which is created in migration)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
    CREATE INDEX IF NOT EXISTS idx_shipments_type ON shipments(type);
    CREATE INDEX IF NOT EXISTS idx_shipments_route ON shipments(routeName);
    CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(deliveryTime);
    CREATE INDEX IF NOT EXISTS idx_acknowledgments_shipment ON acknowledgments(shipmentId);
    CREATE INDEX IF NOT EXISTS idx_sync_status_shipment ON sync_status(shipmentId);
    CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status);
  `);
};

// Migration function to add latitude and longitude columns to existing databases
const migrateDatabase = (db: Database.Database) => {
  try {
    // Check if latitude column exists
    const tableInfo = db.prepare("PRAGMA table_info(shipments)").all();
    const hasLatitude = tableInfo.some((col: any) => col.name === 'latitude');
    const hasLongitude = tableInfo.some((col: any) => col.name === 'longitude');

    if (!hasLatitude) {
      console.log('Adding latitude column to shipments table...');
      db.exec('ALTER TABLE shipments ADD COLUMN latitude REAL');
    }

    if (!hasLongitude) {
      console.log('Adding longitude column to shipments table...');
      db.exec('ALTER TABLE shipments ADD COLUMN longitude REAL');
    }

    // Create location index after ensuring both columns exist
    const updatedTableInfo = db.prepare("PRAGMA table_info(shipments)").all();
    const finalHasLatitude = updatedTableInfo.some((col: any) => col.name === 'latitude');
    const finalHasLongitude = updatedTableInfo.some((col: any) => col.name === 'longitude');

    if (finalHasLatitude && finalHasLongitude) {
      console.log('Creating location index...');
      db.exec('CREATE INDEX IF NOT EXISTS idx_shipments_location ON shipments(latitude, longitude)');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
};

initTables(liveDb);
initTables(replicaDb);

// Run migrations on both databases
migrateDatabase(liveDb);
migrateDatabase(replicaDb);

export { initTables, migrateDatabase };
