import pkg from 'pg';
const { Pool } = pkg;
import { log } from "../../shared/utils/logger.js";

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const isLocalhost = process.env.DEPLOYMENT_ENV === 'localhost' || process.env.DEPLOYMENT_ENV === 'alpha';

// Main database configuration
const mainDbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/riderpro',
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  max: isProduction ? 20 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Backup/replica database configuration (for dev/alpha environments only)
const backupDbConfig = {
  connectionString: process.env.BACKUP_DATABASE_URL || 'postgres://postgres:password@localhost:5432/riderpro_backup',
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Export main pool
export const pool = new Pool(mainDbConfig);

// Export backup pool (only for dev/alpha environments)
export const backupPool = (isDevelopment || isLocalhost) ? new Pool(backupDbConfig) : null;

// Test main connection
pool.on('error', (err, _client) => {
  log.error('Unexpected error on idle PostgreSQL client (main)', err);
  process.exit(-1);
});

// Test backup connection (if available)
if (backupPool) {
  backupPool.on('error', (err, _client) => {
    log.error('Unexpected error on idle PostgreSQL client (backup)', err);
  });
}

// Database health check
export const checkDatabaseHealth = async (): Promise<{ main: boolean; backup: boolean | null }> => {
  let mainHealthy = false;
  let backupHealthy: boolean | null = null;

  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    mainHealthy = !!result.rows[0];
    log.dev(`✓ Main database connected: ${result.rows[0].db}`);
  } catch (error) {
    log.error('Main database health check failed', error);
  }

  if (backupPool) {
    try {
      const result = await backupPool.query('SELECT NOW() as time, current_database() as db');
      backupHealthy = !!result.rows[0];
      log.dev(`✓ Backup database connected: ${result.rows[0].db}`);
    } catch (error) {
      log.warn('Backup database health check failed', error);
      backupHealthy = false;
    }
  }

  return { main: mainHealthy, backup: backupHealthy };
};

// Get appropriate pool based on environment and operation type
export const getPool = (useBackup = false): typeof pool => {
  if (useBackup && backupPool && (isDevelopment || isLocalhost)) {
    return backupPool;
  }
  return pool;
};

// Initialize tables function (will be called by migration script or startup)
export const initTables = async () => {
  const client = await pool.connect();
  try {
    log.info('Initializing database tables...');
    
    await client.query('BEGIN');

    // Shipments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL CHECK(type IN ('delivery', 'pickup')),
        "customerName" TEXT NOT NULL,
        "customerMobile" TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        cost REAL NOT NULL,
        "deliveryTime" TIMESTAMP WITH TIME ZONE NOT NULL,
        "routeName" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Assigned' CHECK(status IN ('Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled')),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "pickupAddress" TEXT,
        weight REAL DEFAULT 0,
        dimensions TEXT,
        "specialInstructions" TEXT,
        "actualDeliveryTime" TIMESTAMP WITH TIME ZONE,
        priority VARCHAR(20) DEFAULT 'medium',
        start_latitude REAL,
        start_longitude REAL,
        stop_latitude REAL,
        stop_longitude REAL,
        km_travelled REAL DEFAULT 0,
        synced_to_external BOOLEAN DEFAULT FALSE,
        last_sync_attempt TIMESTAMP WITH TIME ZONE,
        sync_error TEXT,
        sync_status VARCHAR(20) DEFAULT 'pending',
        sync_attempts INTEGER DEFAULT 0,
        signature_url TEXT,
        photo_url TEXT,
        acknowledgment_captured_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Route sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS route_sessions (
        id VARCHAR(255) PRIMARY KEY,
        employee_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        start_latitude REAL NOT NULL,
        start_longitude REAL NOT NULL,
        end_latitude REAL,
        end_longitude REAL,
        total_distance REAL DEFAULT 0,
        total_time INTEGER DEFAULT 0,
        fuel_consumed REAL DEFAULT 0,
        fuel_cost REAL DEFAULT 0,
        average_speed REAL DEFAULT 0,
        shipments_completed INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Route tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS route_tracking (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL REFERENCES route_sessions(id),
        employee_id VARCHAR(255) NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        accuracy REAL,
        speed REAL,
        event_type VARCHAR(50) DEFAULT 'gps',
        shipment_id VARCHAR(255),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        fuel_efficiency REAL DEFAULT 15.0,
        fuel_price REAL DEFAULT 1.5
      )
    `);

    // Vehicle types table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_types (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        fuel_efficiency REAL NOT NULL,
        description TEXT,
        icon VARCHAR(50) DEFAULT 'car',
        fuel_type VARCHAR(50) DEFAULT 'petrol',
        co2_emissions REAL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fuel settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fuel_settings (
        id VARCHAR(255) PRIMARY KEY,
        fuel_type VARCHAR(50) NOT NULL DEFAULT 'petrol',
        price_per_liter REAL NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        region VARCHAR(100),
        effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Feature flags table
    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        name VARCHAR(255) PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        description TEXT,
        rollout_percentage INTEGER DEFAULT 0,
        target_users TEXT,
        target_roles TEXT,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        metadata TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(255)
      )
    `);

    // System health metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_health_metrics (
        id VARCHAR(255) PRIMARY KEY,
        metric_name VARCHAR(255) NOT NULL,
        metric_value REAL NOT NULL,
        metric_unit VARCHAR(50),
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rider accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rider_accounts (
        id VARCHAR(255) PRIMARY KEY,
        rider_id VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_approved BOOLEAN DEFAULT FALSE,
        is_rider BOOLEAN DEFAULT FALSE,
        is_super_user BOOLEAN DEFAULT FALSE,
        role VARCHAR(50) DEFAULT 'is_driver' CHECK(role IN ('is_super_user', 'is_rider', 'is_driver')),
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        employee_id VARCHAR(255),
        full_name VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        is_super_user BOOLEAN DEFAULT FALSE,
        is_ops_team BOOLEAN DEFAULT FALSE,
        is_staff BOOLEAN DEFAULT FALSE,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id),
        access_token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes optimized for role-based access ONLY
    await client.query(`
      -- Shipments indexes - role and employee-based filtering only
      CREATE INDEX IF NOT EXISTS idx_shipments_employee_id ON shipments("employeeId");
      CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments("createdAt");
      CREATE INDEX IF NOT EXISTS idx_shipments_sync_status ON shipments(synced_to_external, sync_status);
      
      -- Composite index for admin/ops filtering (status, type, routeName) with sort optimization
      CREATE INDEX IF NOT EXISTS idx_shipments_admin_filters ON shipments(status, type, "routeName", "createdAt" DESC);
      
      -- GPS/location indexes for route visualization (partial index for non-null values)
      CREATE INDEX IF NOT EXISTS idx_shipments_location ON shipments(latitude, longitude) 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
      
      -- Route tracking indexes for analytics
      CREATE INDEX IF NOT EXISTS idx_route_tracking_session ON route_tracking(session_id);
      CREATE INDEX IF NOT EXISTS idx_route_tracking_employee ON route_tracking(employee_id);
      CREATE INDEX IF NOT EXISTS idx_route_tracking_date ON route_tracking(date);
      CREATE INDEX IF NOT EXISTS idx_route_tracking_timestamp ON route_tracking(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_route_tracking_employee_date ON route_tracking(employee_id, date);
      
      -- Route sessions indexes for performance metrics
      CREATE INDEX IF NOT EXISTS idx_route_sessions_employee ON route_sessions(employee_id);
      CREATE INDEX IF NOT EXISTS idx_route_sessions_start_time ON route_sessions(start_time DESC);
      
      -- User indexes for authentication
      CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
      
      -- Session cleanup index
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
    `);

    await client.query('COMMIT');
    log.info('✓ Database tables and indexes initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    log.error('Failed to initialize database tables', error);
    throw error;
  } finally {
    client.release();
  }
};

// Initialize backup database with same schema
export const initBackupDatabase = async () => {
  if (!backupPool) {
    log.dev('Backup database not configured, skipping initialization');
    return;
  }

  const client = await backupPool.connect();
  try {
    log.info('Initializing backup database with same schema...');
    
    await client.query('BEGIN');

    // Copy same schema from main database
    // Shipments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL CHECK(type IN ('delivery', 'pickup')),
        "customerName" TEXT NOT NULL,
        "customerMobile" TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        cost REAL NOT NULL,
        "deliveryTime" TIMESTAMP WITH TIME ZONE NOT NULL,
        "routeName" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Assigned' CHECK(status IN ('Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled')),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "pickupAddress" TEXT,
        weight REAL DEFAULT 0,
        dimensions TEXT,
        "specialInstructions" TEXT,
        "actualDeliveryTime" TIMESTAMP WITH TIME ZONE,
        priority VARCHAR(20) DEFAULT 'medium',
        start_latitude REAL,
        start_longitude REAL,
        stop_latitude REAL,
        stop_longitude REAL,
        km_travelled REAL DEFAULT 0,
        synced_to_external BOOLEAN DEFAULT FALSE,
        last_sync_attempt TIMESTAMP WITH TIME ZONE,
        sync_error TEXT,
        sync_status VARCHAR(20) DEFAULT 'pending',
        sync_attempts INTEGER DEFAULT 0,
        signature_url TEXT,
        photo_url TEXT,
        acknowledgment_captured_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Route sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS route_sessions (
        id VARCHAR(255) PRIMARY KEY,
        employee_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        start_latitude REAL NOT NULL,
        start_longitude REAL NOT NULL,
        end_latitude REAL,
        end_longitude REAL,
        total_distance REAL DEFAULT 0,
        total_time INTEGER DEFAULT 0,
        fuel_consumed REAL DEFAULT 0,
        fuel_cost REAL DEFAULT 0,
        average_speed REAL DEFAULT 0,
        shipments_completed INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Route tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS route_tracking (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        employee_id VARCHAR(255) NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        accuracy REAL,
        speed REAL,
        event_type VARCHAR(50) DEFAULT 'gps',
        shipment_id VARCHAR(255),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        fuel_efficiency REAL DEFAULT 15.0,
        fuel_price REAL DEFAULT 1.5
      )
    `);

    // Create same indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_employee_id ON shipments("employeeId");
      CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments("createdAt");
      CREATE INDEX IF NOT EXISTS idx_route_tracking_employee_date ON route_tracking(employee_id, date);
    `);

    await client.query('COMMIT');
    log.info('✓ Backup database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    log.error('Failed to initialize backup database', error);
    throw error;
  } finally {
    client.release();
  }
};

// Sync recent data to backup (last 3 days for dev/alpha)
export const syncToBackup = async () => {
  if (!backupPool || isProduction) {
    return;
  }

  try {
    log.dev('Syncing last 3 days of data to backup database...');
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Get recent shipments from main DB
    const mainClient = await pool.connect();
    const backupClient = await backupPool.connect();

    try {
      const recentShipments = await mainClient.query(
        `SELECT * FROM shipments WHERE "createdAt" >= $1 ORDER BY "createdAt" DESC`,
        [threeDaysAgo]
      );

      // Clear old data in backup
      await backupClient.query('DELETE FROM shipments WHERE "createdAt" < $1', [threeDaysAgo]);

      // Insert recent data
      for (const shipment of recentShipments.rows) {
        await backupClient.query(
          `INSERT INTO shipments (
            id, type, "customerName", "customerMobile", address, latitude, longitude, 
            cost, "deliveryTime", "routeName", "employeeId", status, "createdAt", "updatedAt",
            "pickupAddress", weight, dimensions, "specialInstructions", "actualDeliveryTime",
            priority, start_latitude, start_longitude, stop_latitude, stop_longitude,
            km_travelled, synced_to_external, last_sync_attempt, sync_error, sync_status,
            sync_attempts, signature_url, photo_url, acknowledgment_captured_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
          ) ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            "updatedAt" = EXCLUDED."updatedAt",
            synced_to_external = EXCLUDED.synced_to_external,
            sync_status = EXCLUDED.sync_status
          `,
          [
            shipment.id, shipment.type, shipment.customerName, shipment.customerMobile,
            shipment.address, shipment.latitude, shipment.longitude, shipment.cost,
            shipment.deliveryTime, shipment.routeName, shipment.employeeId, shipment.status,
            shipment.createdAt, shipment.updatedAt, shipment.pickupAddress, shipment.weight,
            shipment.dimensions, shipment.specialInstructions, shipment.actualDeliveryTime,
            shipment.priority, shipment.start_latitude, shipment.start_longitude,
            shipment.stop_latitude, shipment.stop_longitude, shipment.km_travelled,
            shipment.synced_to_external, shipment.last_sync_attempt, shipment.sync_error,
            shipment.sync_status, shipment.sync_attempts, shipment.signature_url,
            shipment.photo_url, shipment.acknowledgment_captured_at
          ]
        );
      }

      log.dev(`✓ Synced ${recentShipments.rows.length} shipments to backup database`);
    } finally {
      mainClient.release();
      backupClient.release();
    }
  } catch (error) {
    log.error('Failed to sync data to backup database', error);
  }
};

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      log.info('Starting database initialization...');
      
      // Check health first
      const health = await checkDatabaseHealth();
      if (!health.main) {
        throw new Error('Main database connection failed');
      }

      // Initialize main database
      await initTables();
      
      // Initialize backup database if in dev/alpha
      if (isDevelopment || isLocalhost) {
        await initBackupDatabase();
        await syncToBackup();
      }

      log.info('✓ All databases initialized successfully');
      process.exit(0);
    } catch (error) {
      log.error('Database initialization failed', error);
      process.exit(1);
    }
  })();
}
