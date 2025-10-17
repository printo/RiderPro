-- Initial Database Tables for RiderPro
-- Complete schema with all tables, indexes, triggers, and RLS policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS system_health_metrics CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS data_processing_log CASCADE;
DROP TABLE IF EXISTS data_anonymization_rules CASCADE;
DROP TABLE IF EXISTS privacy_settings CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS route_tracking CASCADE;
DROP TABLE IF EXISTS route_sessions CASCADE;
DROP TABLE IF EXISTS sync_status CASCADE;
DROP TABLE IF EXISTS acknowledgments CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS rider_accounts CASCADE;
DROP TABLE IF EXISTS riders CASCADE;
DROP TABLE IF EXISTS rider_passwords CASCADE;
DROP TABLE IF EXISTS vehicle_types CASCADE;
DROP TABLE IF EXISTS fuel_settings CASCADE;

-- Shipments table
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('delivery', 'pickup')),
  "customerName" TEXT NOT NULL,
  "customerMobile" TEXT NOT NULL,
  address TEXT NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  "deliveryTime" TEXT NOT NULL,
  "routeName" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Assigned' CHECK(status IN ('Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled')),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes for shipments
CREATE INDEX idx_shipments_employee_id ON shipments("employeeId");
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_route_name ON shipments("routeName");
CREATE INDEX idx_shipments_delivery_time ON shipments("deliveryTime");
CREATE INDEX idx_shipments_created_at ON shipments("createdAt");

-- Acknowledgments table
CREATE TABLE acknowledgments (
  id TEXT PRIMARY KEY,
  "shipmentId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "acknowledgmentType" TEXT NOT NULL CHECK("acknowledgmentType" IN ('delivery', 'pickup', 'return')),
  "acknowledgmentTime" TIMESTAMP NOT NULL,
  "customerSignature" TEXT,
  "photoUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("shipmentId") REFERENCES shipments(id) ON DELETE CASCADE
);

-- Indexes for acknowledgments
CREATE INDEX idx_acknowledgments_shipment_id ON acknowledgments("shipmentId");
CREATE INDEX idx_acknowledgments_employee_id ON acknowledgments("employeeId");
CREATE INDEX idx_acknowledgments_type ON acknowledgments("acknowledgmentType");
CREATE INDEX idx_acknowledgments_time ON acknowledgments("acknowledgmentTime");

-- Sync status table
CREATE TABLE sync_status (
  id TEXT PRIMARY KEY,
  "lastSyncTime" TIMESTAMP NOT NULL,
  "syncStatus" TEXT NOT NULL CHECK("syncStatus" IN ('success', 'failed', 'in_progress')),
  "recordsProcessed" INTEGER DEFAULT 0,
  "recordsFailed" INTEGER DEFAULT 0,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes for sync status
CREATE INDEX idx_sync_status_last_sync ON sync_status("lastSyncTime");
CREATE INDEX idx_sync_status_status ON sync_status("syncStatus");

-- Route sessions table
CREATE TABLE route_sessions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
  start_latitude NUMERIC(10,8) NOT NULL,
  start_longitude NUMERIC(11,8) NOT NULL,
  end_latitude NUMERIC(10,8),
  end_longitude NUMERIC(11,8),
  total_distance NUMERIC(10,2) DEFAULT 0,
  total_time INTEGER DEFAULT 0,
  -- Battery tracking columns
  start_battery_level NUMERIC(5,2) DEFAULT 1.0,
  end_battery_level NUMERIC(5,2),
  min_battery_level NUMERIC(5,2) DEFAULT 1.0,
  battery_drain_rate NUMERIC(5,2) DEFAULT 0.0,
  charging_events INTEGER DEFAULT 0,
  low_battery_warnings INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for route sessions
CREATE INDEX idx_route_sessions_employee_id ON route_sessions(employee_id);
CREATE INDEX idx_route_sessions_status ON route_sessions(status);
CREATE INDEX idx_route_sessions_start_time ON route_sessions(start_time);
CREATE INDEX idx_route_sessions_created_at ON route_sessions(created_at);

-- Route tracking table
CREATE TABLE route_tracking (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  latitude NUMERIC(10,8) NOT NULL,
  longitude NUMERIC(11,8) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  accuracy NUMERIC(10,2),
  speed NUMERIC(10,2),
  event_type TEXT DEFAULT 'gps',
  shipment_id TEXT,
  date DATE NOT NULL,
  fuel_efficiency NUMERIC(10,2) DEFAULT 15.0,
  fuel_price NUMERIC(10,2) DEFAULT 1.5,
  -- Battery tracking columns
  battery_level NUMERIC(5,2),
  is_charging BOOLEAN DEFAULT FALSE,
  network_type TEXT,
  signal_strength INTEGER,
  FOREIGN KEY (session_id) REFERENCES route_sessions (id) ON DELETE CASCADE
);

-- Indexes for route tracking
CREATE INDEX idx_route_tracking_session_id ON route_tracking(session_id);
CREATE INDEX idx_route_tracking_employee_id ON route_tracking(employee_id);
CREATE INDEX idx_route_tracking_timestamp ON route_tracking(timestamp);
CREATE INDEX idx_route_tracking_date ON route_tracking(date);
CREATE INDEX idx_route_tracking_location ON route_tracking(latitude, longitude);

-- Users table (for general user management)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'driver' CHECK(role IN ('admin', 'manager', 'driver', 'viewer')),
  is_active BOOLEAN DEFAULT TRUE,
  is_super_user BOOLEAN DEFAULT FALSE,
  is_ops_team BOOLEAN DEFAULT FALSE,
  is_staff BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- User sessions table
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for user sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Riders table (for rider-specific data)
CREATE TABLE riders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for riders
CREATE INDEX idx_riders_employee_id ON riders(employee_id);

-- Rider accounts table (for rider authentication and management)
CREATE TABLE rider_accounts (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  role TEXT DEFAULT 'driver',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for rider accounts
CREATE INDEX idx_rider_accounts_rider_id ON rider_accounts(rider_id);
CREATE INDEX idx_rider_accounts_approved ON rider_accounts(is_approved);
CREATE INDEX idx_rider_accounts_active ON rider_accounts(is_active);

-- Rider passwords table (for secure password storage)
CREATE TABLE rider_passwords (
  rider_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
);

-- Vehicle types table
CREATE TABLE vehicle_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fuel_efficiency NUMERIC(10,2) DEFAULT 15.0,
  max_capacity INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for vehicle types
CREATE INDEX idx_vehicle_types_name ON vehicle_types(name);
CREATE INDEX idx_vehicle_types_active ON vehicle_types(is_active);

-- Fuel settings table
CREATE TABLE fuel_settings (
  id TEXT PRIMARY KEY,
  fuel_type TEXT NOT NULL,
  price_per_liter NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fuel settings
CREATE INDEX idx_fuel_settings_type ON fuel_settings(fuel_type);
CREATE INDEX idx_fuel_settings_active ON fuel_settings(is_active);

-- Audit logs table
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for audit logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Privacy settings table
CREATE TABLE privacy_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data_retention_days INTEGER DEFAULT 365,
  location_tracking BOOLEAN DEFAULT TRUE,
  analytics_tracking BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for privacy settings
CREATE INDEX idx_privacy_settings_user_id ON privacy_settings(user_id);

-- Data anonymization rules table
CREATE TABLE data_anonymization_rules (
  id TEXT PRIMARY KEY,
  rule_name TEXT UNIQUE NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  anonymization_method TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for data anonymization rules
CREATE INDEX idx_anonymization_rules_table ON data_anonymization_rules(table_name);
CREATE INDEX idx_anonymization_rules_active ON data_anonymization_rules(is_active);

-- Data processing log table
CREATE TABLE data_processing_log (
  id TEXT PRIMARY KEY,
  process_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('started', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  FOREIGN KEY (process_name) REFERENCES data_anonymization_rules(rule_name)
);

-- Indexes for data processing log
CREATE INDEX idx_data_processing_log_process ON data_processing_log(process_name);
CREATE INDEX idx_data_processing_log_status ON data_processing_log(status);
CREATE INDEX idx_data_processing_log_started ON data_processing_log(started_at);

-- System config table
CREATE TABLE system_config (
  id TEXT PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for system config
CREATE INDEX idx_system_config_key ON system_config(config_key);

-- Feature flags table
CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  flag_name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  target_users TEXT[], -- Array of user IDs or roles
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for feature flags
CREATE INDEX idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(is_enabled);

-- System health metrics table
CREATE TABLE system_health_metrics (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(10,4) NOT NULL,
  metric_unit TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Indexes for system health metrics
CREATE INDEX idx_health_metrics_name ON system_health_metrics(metric_name);
CREATE INDEX idx_health_metrics_timestamp ON system_health_metrics(timestamp);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_acknowledgments_updated_at BEFORE UPDATE ON acknowledgments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sync_status_updated_at BEFORE UPDATE ON sync_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_route_sessions_updated_at BEFORE UPDATE ON route_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON riders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rider_accounts_updated_at BEFORE UPDATE ON rider_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rider_passwords_updated_at BEFORE UPDATE ON rider_passwords FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_types_updated_at BEFORE UPDATE ON vehicle_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fuel_settings_updated_at BEFORE UPDATE ON fuel_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_privacy_settings_updated_at BEFORE UPDATE ON privacy_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_anonymization_rules_updated_at BEFORE UPDATE ON data_anonymization_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies for data protection
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_passwords ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on requirements)
CREATE POLICY "Users can view their own data" ON shipments FOR SELECT USING ("employeeId" = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view their own data" ON acknowledgments FOR SELECT USING ("employeeId" = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view their own data" ON route_sessions FOR SELECT USING (employee_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can view their own data" ON route_tracking FOR SELECT USING (employee_id = current_setting('app.current_user_id', true));

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'RiderPro initial database setup completed successfully!';
    RAISE NOTICE 'All tables, indexes, triggers, and RLS policies have been created.';
END $$;