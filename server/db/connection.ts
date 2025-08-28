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

export const liveDb = new Database(liveDbPath);
export const replicaDb = new Database(replicaDbPath);

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

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
    CREATE INDEX IF NOT EXISTS idx_shipments_type ON shipments(type);
    CREATE INDEX IF NOT EXISTS idx_shipments_route ON shipments(routeName);
    CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(deliveryTime);
    CREATE INDEX IF NOT EXISTS idx_acknowledgments_shipment ON acknowledgments(shipmentId);
  `);
};

initTables(liveDb);
initTables(replicaDb);

export { initTables };
