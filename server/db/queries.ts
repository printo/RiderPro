import { pool } from './connection.js';
// cspell:ignore ILIKE
import { 
  Shipment, InsertShipment, UpdateShipment, 
  DashboardMetrics, ShipmentFilters, 
  VehicleType, InsertVehicleType, UpdateVehicleType,
  FuelSetting, InsertFuelSetting, UpdateFuelSetting,
  InsertAcknowledgment, Acknowledgment, User, UserRole
} from '@shared/types';
import { log } from "../../shared/utils/logger.js";

// Local interface definitions for types not yet in shared/types
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rollout_percentage: number;
  target_users?: string;
  target_roles?: string;
  start_date?: string;
  end_date?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface InsertFeatureFlag {
  name: string;
  enabled?: boolean;
  description?: string;
  rollout_percentage?: number;
  target_users?: string;
  target_roles?: string;
  start_date?: string;
  end_date?: string;
  metadata?: string;
  updated_by?: string;
}

export interface UpdateFeatureFlag {
  enabled?: boolean;
  description?: string;
  rollout_percentage?: number;
  target_users?: string;
  target_roles?: string;
  start_date?: string;
  end_date?: string;
  metadata?: string;
  updated_by?: string;
}

export interface SystemHealthMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  timestamp: string;
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  access_token: string;
  expires_at: string;
  created_at: string;
}

// Helper types for User operations
export type InsertUser = Omit<User, 'createdAt' | 'updatedAt' | 'lastLogin'> & {
  lastLogin?: string;
  accessToken?: string;
  refreshToken?: string;
};

export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & {
  accessToken?: string;
  refreshToken?: string;
  lastLogin?: string;
};

export class ShipmentQueries {
  
  constructor(_useReplica = false) {
    // Postgres pool handles connections automatically
  }

  getDatabase() {
    return pool;
  }

  // --- Shipment Operations ---

  async getAllShipments(filters: ShipmentFilters = {}): Promise<{ data: Shipment[]; total: number }> {
    let countQuery = `SELECT COUNT(*) as total FROM shipments WHERE 1=1`;
    let dataQuery = `SELECT * FROM shipments WHERE 1=1`;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.status) {
      countQuery += ` AND status = $${paramIndex}`;
      dataQuery += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.priority) {
      countQuery += ` AND priority = $${paramIndex}`;
      dataQuery += ` AND priority = $${paramIndex}`;
      params.push(filters.priority);
      paramIndex++;
    }

    if (filters.type) {
      countQuery += ` AND type = $${paramIndex}`;
      dataQuery += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.routeName) {
      countQuery += ` AND "routeName" = $${paramIndex}`;
      dataQuery += ` AND "routeName" = $${paramIndex}`;
      params.push(filters.routeName);
      paramIndex++;
    }

    if (filters.date) {
      countQuery += ` AND DATE("deliveryTime") = $${paramIndex}`;
      dataQuery += ` AND DATE("deliveryTime") = $${paramIndex}`;
      params.push(filters.date);
      paramIndex++;
    }

    if (filters.employeeId) {
      countQuery += ` AND "employeeId" = $${paramIndex}`;
      dataQuery += ` AND "employeeId" = $${paramIndex}`;
      params.push(filters.employeeId);
      paramIndex++;
    }

    if (filters.search) {
      countQuery += ` AND ("customerName" ILIKE $${paramIndex} OR address ILIKE $${paramIndex} OR id ILIKE $${paramIndex})`;
      dataQuery += ` AND ("customerName" ILIKE $${paramIndex} OR address ILIKE $${paramIndex} OR id ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const sortField = filters.sortField ? `"${filters.sortField}"` : '"createdAt"';
    const sortOrder = filters.sortOrder || 'DESC';
    dataQuery += ` ORDER BY ${sortField} ${sortOrder}`;

    const page = Math.max(1, parseInt(String(filters.page || 1)));
    const limit = Math.min(100, Math.max(1, parseInt(String(filters.limit || 20))));
    const offset = (page - 1) * limit;

    dataQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataParams = [...params, limit, offset];

    try {
      const [countResult, dataResult] = await Promise.all([
        pool.query(countQuery, params),
        pool.query(dataQuery, dataParams)
      ]);

      return {
        data: dataResult.rows,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error) {
      log.error('Error fetching shipments:', error);
      throw error;
    }
  }

  async getShipmentById(id: string): Promise<Shipment | undefined> {
    const result = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getShipmentByExternalId(externalId: string): Promise<Shipment | undefined> {
    const result = await pool.query('SELECT * FROM shipments WHERE piashipmentid = $1', [externalId]);
    return result.rows[0];
  }

  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    const keys = Object.keys(shipment).map(k => `"${k}"`).join(', ');
    const values = Object.values(shipment);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    // Use ON CONFLICT to prevent duplicates and update if exists
    const updateKeys = Object.keys(shipment).filter(k => k !== 'id').map(k => `"${k}"`);
    const updateClause = updateKeys.map(k => `${k} = EXCLUDED.${k}`).join(', ');

    const query = `
      INSERT INTO shipments (${keys}) 
      VALUES (${placeholders}) 
      ON CONFLICT (id) DO UPDATE SET 
        ${updateClause},
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async updateShipment(id: string, updates: UpdateShipment): Promise<Shipment | undefined> {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getShipmentById(id);

    const setClause = keys.map((key, i) => `"${key}" = $${i + 2}`).join(', ');
    const values = Object.values(updates);

    const query = `UPDATE shipments SET ${setClause}, "updatedAt" = NOW() WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0];
  }

  async batchUpdateShipments(updates: UpdateShipment[]): Promise<number> {
    if (updates.length === 0) return 0;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let count = 0;
      for (const update of updates) {
        if (update.shipment_id) {
          const keys = Object.keys(update).filter(k => k !== 'shipment_id');
          if (keys.length > 0) {
            const setClause = keys.map((key, i) => `"${key}" = $${i + 2}`).join(', ');
            const values = keys.map(k => (update as unknown as Record<string, unknown>)[k]);
            await client.query(
              `UPDATE shipments SET ${setClause}, "updatedAt" = NOW() WHERE id = $1`,
              [update.shipment_id, ...values]
            );
            count++;
          }
        }
      }
      await client.query('COMMIT');
      return count;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async batchCreateOrUpdateShipments(shipments: Array<{ external: { id: string }, internal: InsertShipment & { piashipmentid?: string, id?: string } }>): Promise<Array<{
    piashipmentid: string;
    internalId: string | null;
    status: 'created' | 'updated' | 'failed';
    message: string;
  }>> {
    const results: Array<{
      piashipmentid: string;
      internalId: string | null;
      status: 'created' | 'updated' | 'failed';
      message: string;
    }> = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of shipments) {
        try {
          // Check if exists by piashipmentid (external id) or id (internal id)
          let existing: Shipment | undefined;
          
          if (item.internal.piashipmentid) {
            const res = await client.query('SELECT * FROM shipments WHERE piashipmentid = $1', [item.internal.piashipmentid]);
            existing = res.rows[0];
          }
          
          if (!existing && item.internal.id) {
            const res = await client.query('SELECT * FROM shipments WHERE id = $1', [item.internal.id]);
            existing = res.rows[0];
          }

          if (existing) {
            // Update
            const updates = { ...item.internal };
            delete (updates as Record<string, unknown>).id;
            
            const keys = Object.keys(updates);
            if (keys.length > 0) {
              const setClause = keys.map((key, i) => `"${key}" = $${i + 2}`).join(', ');
              const values = Object.values(updates);
              await client.query(
                `UPDATE shipments SET ${setClause}, "updatedAt" = NOW() WHERE id = $1`,
                [existing.shipment_id, ...values]
              );
              results.push({
                piashipmentid: item.external.id,
                internalId: existing.shipment_id,
                status: 'updated',
                message: 'Shipment updated successfully'
              });
            } else {
               results.push({
                piashipmentid: item.external.id,
                internalId: existing.shipment_id,
                status: 'updated',
                message: 'No changes needed'
              });
            }
          } else {
            // Create
            const insertData = item.internal;
            const keys = Object.keys(insertData).map(k => `"${k}"`).join(', ');
            const values = Object.values(insertData);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

            const res = await client.query(
              `INSERT INTO shipments (${keys}) VALUES (${placeholders}) RETURNING id`,
              values
            );
            
            results.push({
              piashipmentid: item.external.id,
              internalId: res.rows[0].id,
              status: 'created',
              message: 'Shipment created successfully'
            });
          }
        } catch (error) {
          log.error(`Error processing shipment ${item.external.id}:`, error);
          results.push({
            piashipmentid: item.external.id,
            internalId: null,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    return results;
  }

  // --- Acknowledgment Operations ---

  async createAcknowledgment(acknowledgment: InsertAcknowledgment): Promise<Acknowledgment> {
    // Acknowledgments are now part of shipment record, but we update the fields
    const query = `
      UPDATE shipments 
      SET "signature_url" = $1, "photo_url" = $2, "acknowledgment_captured_at" = $3, "acknowledgment_captured_by" = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await pool.query(query, [
      acknowledgment.signatureUrl, 
      acknowledgment.photoUrl, 
      acknowledgment.acknowledgment_captured_at, 
      acknowledgment.acknowledgment_captured_by,
      acknowledgment.shipment_id
    ]);
    
    // Return dummy Acknowledgment object to satisfy interface
    const shipment = result.rows[0];
    return {
      id: shipment.id + '_ack',
      shipment_id: shipment.id,
      signatureUrl: shipment.signature_url,
      photoUrl: shipment.photo_url,
      acknowledgment_captured_at: shipment.acknowledgment_captured_at,
      acknowledgment_captured_by: shipment.acknowledgment_captured_by,
      createdAt: shipment.updatedAt,
      updatedAt: shipment.updatedAt
    };
  }

  async getAcknowledmentByShipmentId(shipmentId: string): Promise<Acknowledgment | undefined> {
    const result = await pool.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
    const shipment = result.rows[0];
    if (!shipment || (!shipment.signature_url && !shipment.photo_url)) return undefined;

    return {
      id: shipment.id + '_ack',
      shipment_id: shipment.id,
      signatureUrl: shipment.signature_url,
      photoUrl: shipment.photo_url,
      acknowledgment_captured_at: shipment.acknowledgment_captured_at,
      acknowledgment_captured_by: shipment.acknowledgment_captured_by,
      createdAt: shipment.updatedAt,
      updatedAt: shipment.updatedAt
    };
  }

  // --- Dashboard Metrics ---

  async getDashboardMetrics(employeeId?: string): Promise<DashboardMetrics> {
    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'In Transit' THEN 1 END) as in_transit,
        COUNT(CASE WHEN status = 'Assigned' THEN 1 END) as assigned,
        COUNT(CASE WHEN status = 'Picked Up' THEN 1 END) as picked_up,
        COUNT(CASE WHEN status = 'Returned' THEN 1 END) as returned,
        COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled
      FROM shipments
    `;
    
    const params: string[] = [];
    if (employeeId) {
      query += ` WHERE "employeeId" = $1`;
      params.push(employeeId);
    }

    const result = await pool.query(query, params);
    const row = result.rows[0];
    const total = parseInt(row.total);
    const delivered = parseInt(row.delivered);
    
    return {
      totalShipments: total,
      completed: delivered,
      inProgress: parseInt(row.in_transit),
      pending: parseInt(row.assigned),
      averageDeliveryTime: 0, // Would require more complex query
      onTimeDeliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      statusBreakdown: {
        'Assigned': parseInt(row.assigned),
        'In Transit': parseInt(row.in_transit),
        'Delivered': delivered,
        'Picked Up': parseInt(row.picked_up),
        'Returned': parseInt(row.returned),
        'Cancelled': parseInt(row.cancelled)
      }
    };
  }

  // --- Vehicle Types ---

  async getAllVehicleTypes(): Promise<VehicleType[]> {
    const result = await pool.query('SELECT * FROM vehicle_types ORDER BY name');
    return result.rows;
  }

  async getVehicleTypeById(id: string): Promise<VehicleType | undefined> {
    const result = await pool.query('SELECT * FROM vehicle_types WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType> {
    const id = Math.random().toString(36).substring(2, 15);
    const query = `
      INSERT INTO vehicle_types (id, name, fuel_efficiency, description, icon, fuel_type, co2_emissions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [
      id, vehicleType.name, vehicleType.fuel_efficiency, vehicleType.description,
      vehicleType.icon || 'car', vehicleType.fuel_type || 'petrol', vehicleType.co2_emissions
    ]);
    return result.rows[0];
  }

  async updateVehicleType(id: string, updates: UpdateVehicleType): Promise<VehicleType | undefined> {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getVehicleTypeById(id);

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = Object.values(updates);

    const query = `UPDATE vehicle_types SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0];
  }

  async deleteVehicleType(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM vehicle_types WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Fuel Settings ---

  async getAllFuelSettings(): Promise<FuelSetting[]> {
    const result = await pool.query('SELECT * FROM fuel_settings ORDER BY effective_date DESC');
    return result.rows;
  }

  async getFuelSettingById(id: string): Promise<FuelSetting | undefined> {
    const result = await pool.query('SELECT * FROM fuel_settings WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createFuelSetting(fuelSetting: InsertFuelSetting): Promise<FuelSetting> {
    const id = Math.random().toString(36).substring(2, 15);
    const query = `
      INSERT INTO fuel_settings (id, fuel_type, price_per_liter, currency, region, effective_date, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await pool.query(query, [
      id, fuelSetting.fuel_type, fuelSetting.price_per_liter, fuelSetting.currency || 'USD',
      fuelSetting.region, fuelSetting.effective_date, fuelSetting.is_active ?? true, fuelSetting.created_by
    ]);
    return result.rows[0];
  }

  async updateFuelSetting(id: string, updates: UpdateFuelSetting): Promise<FuelSetting | undefined> {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getFuelSettingById(id);

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = Object.values(updates);

    const query = `UPDATE fuel_settings SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0];
  }

  async deleteFuelSetting(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM fuel_settings WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Route & Tracking Operations ---

  async recordShipmentEvent(event: {
    sessionId: string;
    shipmentId: string;
    eventType: string;
    latitude: number;
    longitude: number;
    employeeId: string;
  }): Promise<Record<string, unknown>> {
    // Record in route_tracking
    const query = `
      INSERT INTO route_tracking (session_id, employee_id, latitude, longitude, timestamp, event_type, shipment_id)
      VALUES ($1, $2, $3, $4, NOW(), $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [
      event.sessionId, event.employeeId, event.latitude, event.longitude, event.eventType, event.shipmentId
    ]);
    return result.rows[0];
  }

  async startRouteSession(data: {
    id: string;
    employeeId: string;
    startLatitude: number;
    startLongitude: number;
    shipmentId?: string;
  }): Promise<Record<string, unknown>> {
    const query = `
      INSERT INTO route_sessions (id, employee_id, start_latitude, start_longitude, start_time, status)
      VALUES ($1, $2, $3, $4, NOW(), 'active')
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.id, data.employeeId, data.startLatitude, data.startLongitude
    ]);
    
    if (data.shipmentId) {
      await this.recordShipmentEvent({
        sessionId: data.id,
        shipmentId: data.shipmentId,
        eventType: 'route_start',
        latitude: data.startLatitude,
        longitude: data.startLongitude,
        employeeId: data.employeeId
      });
    }

    return result.rows[0];
  }

  async stopRouteSession(data: {
    sessionId: string;
    endLatitude: number;
    endLongitude: number;
  }): Promise<Record<string, unknown>> {
    const query = `
      UPDATE route_sessions 
      SET end_latitude = $2, end_longitude = $3, end_time = NOW(), status = 'completed'
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [data.sessionId, data.endLatitude, data.endLongitude]);
    return result.rows[0];
  }

  async recordCoordinate(data: {
    sessionId: string;
    latitude: number;
    longitude: number;
    timestamp?: string;
    employeeId?: string;
  }): Promise<Record<string, unknown>> {
    const query = `
      INSERT INTO route_tracking (session_id, employee_id, latitude, longitude, timestamp, event_type)
      VALUES ($1, $2, $3, $4, $5, 'gps')
      RETURNING *
    `;
    // We need employee_id, if not provided we might need to fetch it from session, but for now assuming it's provided or we can skip
    // If employeeId is missing, try to get it from session
    let employeeId = data.employeeId;
    if (!employeeId) {
      const session = await pool.query('SELECT employee_id FROM route_sessions WHERE id = $1', [data.sessionId]);
      employeeId = session.rows[0]?.employee_id || 'unknown';
    }

    const result = await pool.query(query, [
      data.sessionId, employeeId, data.latitude, data.longitude, data.timestamp || new Date().toISOString()
    ]);
    return result.rows[0];
  }

  // --- Feature Flags ---
  
  async getFeatureFlag(name: string): Promise<FeatureFlag | undefined> {
    const result = await pool.query('SELECT * FROM feature_flags WHERE name = $1', [name]);
    return result.rows[0];
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    const result = await pool.query('SELECT * FROM feature_flags ORDER BY name');
    return result.rows;
  }

  async updateFeatureFlag(name: string, updates: UpdateFeatureFlag): Promise<FeatureFlag | undefined> {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getFeatureFlag(name);

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = Object.values(updates);

    const query = `UPDATE feature_flags SET ${setClause}, updated_at = NOW() WHERE name = $1 RETURNING *`;
    const result = await pool.query(query, [name, ...values]);
    return result.rows[0];
  }

  // --- System Health ---

  async createSystemHealthMetric(metric: Omit<SystemHealthMetric, 'created_at'>): Promise<SystemHealthMetric> {
    const query = `
      INSERT INTO system_health_metrics (id, metric_name, metric_value, metric_unit, timestamp)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      metric.id, metric.metric_name, metric.metric_value, metric.metric_unit, metric.timestamp
    ]);
    return result.rows[0];
  }

  async getSystemHealthMetrics(limit = 100): Promise<SystemHealthMetric[]> {
    const result = await pool.query('SELECT * FROM system_health_metrics ORDER BY timestamp DESC LIMIT $1', [limit]);
    return result.rows;
  }

  // --- User & Session Operations (for Auth) ---

  async getUserByToken(token: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE access_token = $1', [token]);
    return result.rows[0] ? this.mapDbUserToUser(result.rows[0]) : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? this.mapDbUserToUser(result.rows[0]) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const query = `
      INSERT INTO users (
        id, username, email, role, employee_id, full_name, 
        access_token, refresh_token, is_active, 
        is_super_user, is_ops_team, is_staff,
        last_login
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      user.id, user.username, user.email, user.role, user.employeeId, user.fullName,
      user.accessToken, user.refreshToken, user.isActive,
      user.isSuperUser, user.isOpsTeam, user.isStaff,
      user.lastLogin
    ];

    const result = await pool.query(query, values);
    return this.mapDbUserToUser(result.rows[0]);
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.employeeId) dbUpdates.employee_id = updates.employeeId;
    if (updates.fullName) dbUpdates.full_name = updates.fullName;
    if (updates.accessToken) dbUpdates.access_token = updates.accessToken;
    if (updates.refreshToken) dbUpdates.refresh_token = updates.refreshToken;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.isSuperUser !== undefined) dbUpdates.is_super_user = updates.isSuperUser;
    if (updates.isOpsTeam !== undefined) dbUpdates.is_ops_team = updates.isOpsTeam;
    if (updates.isStaff !== undefined) dbUpdates.is_staff = updates.isStaff;
    if (updates.lastLogin) dbUpdates.last_login = updates.lastLogin;

    const keys = Object.keys(dbUpdates);
    if (keys.length === 0) return this.getUserById(id);

    const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = Object.values(dbUpdates);

    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] ? this.mapDbUserToUser(result.rows[0]) : undefined;
  }

  async createSession(session: UserSession): Promise<UserSession> {
    const query = `
      INSERT INTO user_sessions (id, user_id, access_token, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [session.id, session.user_id, session.access_token, session.expires_at]);
    return result.rows[0];
  }

  async getSessionByToken(token: string): Promise<UserSession | undefined> {
    const result = await pool.query('SELECT * FROM user_sessions WHERE access_token = $1 AND expires_at > NOW()', [token]);
    return result.rows[0];
  }

  async updateSession(id: string, token: string, expiresAt: string): Promise<UserSession | undefined> {
     const query = `
      UPDATE user_sessions 
      SET access_token = $2, expires_at = $3 
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id, token, expiresAt]);
    return result.rows[0];
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await pool.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    return result.rowCount ?? 0;
  }

  private mapDbUserToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      username: row.username as string,
      email: row.email as string,
      role: row.role as UserRole,
      employeeId: row.employee_id as string,
      fullName: row.full_name as string,
      isActive: row.is_active as boolean,
      isApproved: row.is_approved as boolean,
      isRider: row.role === 'driver' || row.role === 'rider',
      isSuperUser: row.is_super_user as boolean,
      isOpsTeam: row.is_ops_team as boolean,
      isStaff: row.is_staff as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }
}
