import { Database } from 'better-sqlite3';

export const up = (db: Database) => {
  console.log('🚀 Creating complete RiderPro database schema...');

  // 1. Route tracking tables
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

  // 2. User authentication tables
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

    -- API tokens table
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT 'read',
      expires_at TEXT,
      last_used TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);

  // 3. Shipments table with all required fields
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      shipment_id TEXT,
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
      actualDeliveryTime TEXT,
      -- Tracking fields
      start_latitude REAL,
      start_longitude REAL,
      stop_latitude REAL,
      stop_longitude REAL,
      km_travelled REAL DEFAULT 0,
      -- Sync tracking
      synced_to_external BOOLEAN DEFAULT 0,
      last_sync_attempt TEXT,
      sync_error TEXT,
      -- Timestamps
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );
  `);

  // 4. Acknowledgments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS acknowledgments (
      id TEXT PRIMARY KEY,
      shipmentId TEXT NOT NULL,
      signatureUrl TEXT,
      photoUrl TEXT,
      capturedAt TEXT NOT NULL,
      FOREIGN KEY (shipmentId) REFERENCES shipments (id)
    );
  `);

  // 5. Sync status tracking table
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
    );
  `);

  // 6. System monitoring tables
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

  // 7. Vehicle types table
  db.exec(`
    -- Vehicle types table
    CREATE TABLE IF NOT EXISTS vehicle_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fuel_efficiency REAL NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'car',
      fuel_type TEXT DEFAULT 'petrol',
      co2_emissions REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 8. Create all indexes for performance
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
    CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);

    -- Vehicle types indexes
    CREATE INDEX IF NOT EXISTS idx_vehicle_types_name ON vehicle_types(name);
    CREATE INDEX IF NOT EXISTS idx_vehicle_types_fuel_type ON vehicle_types(fuel_type);

    -- Shipments indexes
    CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
    CREATE INDEX IF NOT EXISTS idx_shipments_type ON shipments(type);
    CREATE INDEX IF NOT EXISTS idx_shipments_route ON shipments(routeName);
    CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(deliveryTime);
    CREATE INDEX IF NOT EXISTS idx_shipments_employee ON shipments(employeeId);
    CREATE INDEX IF NOT EXISTS idx_shipments_shipment_id ON shipments(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_synced ON shipments(synced_to_external);

    -- Acknowledgments indexes
    CREATE INDEX IF NOT EXISTS idx_acknowledgments_shipment ON acknowledgments(shipmentId);

    -- Sync status indexes
    CREATE INDEX IF NOT EXISTS idx_sync_status_shipment ON sync_status(shipmentId);
    CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status);

    -- System monitoring indexes
    CREATE INDEX IF NOT EXISTS idx_health_metrics_name ON system_health_metrics(metric_name);
    CREATE INDEX IF NOT EXISTS idx_health_metrics_timestamp ON system_health_metrics(timestamp);
    CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);
    CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
  `);

  // 9. Insert default data
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

    -- Insert default vehicle types
    INSERT OR IGNORE INTO vehicle_types (id, name, fuel_efficiency, description, icon, fuel_type, co2_emissions) VALUES
    ('vt_001', 'Standard Van', 15.0, 'Standard delivery van', 'truck', 'diesel', 0.2),
    ('vt_002', 'Small Car', 20.0, 'Small delivery car', 'car', 'petrol', 0.15),
    ('vt_003', 'Motorcycle', 35.0, 'Delivery motorcycle', 'car', 'petrol', 0.1),
    ('vt_004', 'Electric Van', 25.0, 'Electric delivery van', 'truck', 'electric', 0.0);
  `);

  console.log('✅ Complete database schema created successfully');
};

export const down = (db: Database) => {
  console.log('🔄 Rolling back complete database schema...');

  // Drop all indexes first
  db.exec(`
    DROP INDEX IF EXISTS idx_system_config_key;
    DROP INDEX IF EXISTS idx_feature_flags_name;
    DROP INDEX IF EXISTS idx_health_metrics_timestamp;
    DROP INDEX IF EXISTS idx_health_metrics_name;
    DROP INDEX IF EXISTS idx_sync_status_status;
    DROP INDEX IF EXISTS idx_sync_status_shipment;
    DROP INDEX IF EXISTS idx_acknowledgments_shipment;
    DROP INDEX IF EXISTS idx_shipments_synced;
    DROP INDEX IF EXISTS idx_shipments_shipment_id;
    DROP INDEX IF EXISTS idx_shipments_employee;
    DROP INDEX IF EXISTS idx_shipments_date;
    DROP INDEX IF EXISTS idx_shipments_route;
    DROP INDEX IF EXISTS idx_shipments_type;
    DROP INDEX IF EXISTS idx_shipments_status;
    DROP INDEX IF EXISTS idx_api_tokens_token_hash;
    DROP INDEX IF EXISTS idx_api_tokens_user_id;
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
    DROP TABLE IF EXISTS sync_status;
    DROP TABLE IF EXISTS acknowledgments;
    DROP TABLE IF EXISTS shipments;
    DROP TABLE IF EXISTS vehicle_types;
    DROP TABLE IF EXISTS api_tokens;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS route_tracking;
    DROP TABLE IF EXISTS route_sessions;
  `);

  console.log('✅ Database schema rolled back successfully');
};
