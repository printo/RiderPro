import { db } from '../db/pg-connection.js';
import { randomUUID } from 'crypto';

export interface RouteSessionRecord {
  id: string;
  employee_id: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude?: number | null;
  end_longitude?: number | null;
  total_distance?: number | null;
  total_time?: number | null;
  average_speed?: number | null;
  fuel_consumed?: number | null;
  fuel_cost?: number | null;
  shipments_completed?: number | null;
  fuel_efficiency?: number | null;
  fuel_price?: number | null;
  vehicle_type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteTrackingRecord {
  id: number;
  session_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number | null;
  speed?: number | null;
  event_type?: string | null;
  shipment_id?: string | null;
  date: string;
  fuel_efficiency?: number | null;
  fuel_price?: number | null;
  vehicle_type?: string | null;
  total_distance?: number | null;
  total_time?: number | null;
  average_speed?: number | null;
  fuel_consumed?: number | null;
  fuel_cost?: number | null;
  shipments_completed?: number | null;
  created_at: string;
  updated_at: string;
}

export interface RouteFilters {
  employeeId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}

export interface RouteAnalytics {
  employeeId: string;
  date: string;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  fuelConsumed: number;
  fuelCost: number;
  shipmentsCompleted: number;
  efficiency: number;
}

export interface GPSCoordinate {
  sessionId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}

class RouteService {
  // Basic CRUD Operations
  async startSession(params: { id: string; employeeId: string; startLatitude: number; startLongitude: number; }): Promise<RouteSessionRecord> {
    const sql = `
      INSERT INTO route_sessions (
        id, employee_id, start_time, status, start_latitude, start_longitude, created_at, updated_at
      ) VALUES ($1,$2,NOW(),'active',$3,$4,NOW(),NOW())
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, fuel_efficiency, fuel_price, vehicle_type, created_at, updated_at
    `;
    const res = await db.query(sql, [params.id, params.employeeId, params.startLatitude, params.startLongitude]);
    return res.rows[0] as RouteSessionRecord;
  }

  async stopSession(params: { id: string; endLatitude: number; endLongitude: number; }): Promise<RouteSessionRecord | null> {
    const sql = `
      UPDATE route_sessions
      SET end_time = NOW(), end_latitude = $2, end_longitude = $3, status = 'completed', updated_at = NOW()
      WHERE id = $1
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, fuel_efficiency, fuel_price, vehicle_type, created_at, updated_at
    `;
    const res = await db.query(sql, [params.id, params.endLatitude, params.endLongitude]);

    if (res.rows[0]) {
      // Calculate and update analytics for the completed session
      await this.updateSessionAnalytics(params.id);
      return res.rows[0] as RouteSessionRecord;
    }
    return null;
  }

  async getRouteSession(sessionId: string): Promise<RouteSessionRecord | null> {
    const sql = `
      SELECT DISTINCT id, employee_id, start_time, end_time, status,
             start_latitude, start_longitude, end_latitude, end_longitude,
             total_distance, total_time, average_speed, fuel_consumed, fuel_cost,
             shipments_completed, fuel_efficiency, fuel_price, vehicle_type,
             created_at, updated_at
      FROM route_sessions 
      WHERE id = $1
      LIMIT 1
    `;
    const res = await db.query(sql, [sessionId]);
    return res.rows[0] as RouteSessionRecord || null;
  }

  async updateRouteSession(sessionId: string, updateData: any): Promise<RouteSessionRecord | null> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.status) {
      updates.push('status = $' + (values.length + 1));
      values.push(updateData.status);
    }
    if (updateData.endTime) {
      updates.push('end_time = $' + (values.length + 1));
      values.push(updateData.endTime);
    }
    if (updateData.endLatitude && updateData.endLongitude) {
      updates.push('end_latitude = $' + (values.length + 1) + ', end_longitude = $' + (values.length + 2));
      values.push(updateData.endLatitude, updateData.endLongitude);
    }

    if (updates.length === 0) {
      return this.getRouteSession(sessionId);
    }

    updates.push('updated_at = $' + (values.length + 1));
    values.push(now);
    values.push(sessionId);

    const sql = `
      UPDATE route_sessions 
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, fuel_efficiency, fuel_price, vehicle_type, created_at, updated_at
    `;

    const res = await db.query(sql, values);
    return res.rows[0] as RouteSessionRecord || null;
  }

  async insertCoordinate(params: { sessionId: string; employeeId: string; latitude: number; longitude: number; accuracy?: number; speed?: number; timestamp?: string; eventType?: string; shipmentId?: string; }): Promise<RouteTrackingRecord> {
    const ts = params.timestamp || new Date().toISOString();
    const dateOnly = ts.slice(0, 10);
    const sql = `
      INSERT INTO route_tracking (
        session_id, employee_id, latitude, longitude, timestamp, accuracy, speed, event_type, shipment_id, date, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING id, session_id, employee_id, latitude, longitude, timestamp, accuracy, speed, event_type, shipment_id, date, fuel_efficiency, fuel_price, vehicle_type, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, created_at, updated_at
    `;
    const res = await db.query(sql, [
      params.sessionId,
      params.employeeId,
      params.latitude,
      params.longitude,
      ts,
      params.accuracy ?? null,
      params.speed ?? null,
      params.eventType ?? 'gps',
      params.shipmentId ?? null,
      dateOnly
    ]);
    return res.rows[0] as RouteTrackingRecord;
  }

  async recordGPSCoordinate(coordinate: GPSCoordinate): Promise<RouteTrackingRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = coordinate.timestamp.split('T')[0]; // YYYY-MM-DD

    const sql = `
      INSERT INTO route_tracking (
        id, session_id, employee_id, latitude, longitude, timestamp, 
        accuracy, speed, date, created_at, updated_at
      ) VALUES ($1, $2, (
        SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = $3 LIMIT 1
      ), $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, session_id, employee_id, latitude, longitude, timestamp, accuracy, speed, event_type, shipment_id, date, fuel_efficiency, fuel_price, vehicle_type, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, created_at, updated_at
    `;

    const res = await db.query(sql, [
      id, coordinate.sessionId, coordinate.sessionId,
      coordinate.latitude, coordinate.longitude, coordinate.timestamp,
      coordinate.accuracy || null, coordinate.speed || null,
      date, now, now
    ]);

    return res.rows[0] as RouteTrackingRecord;
  }

  async recordShipmentEvent(sessionId: string, shipmentId: string, eventType: 'pickup' | 'delivery', latitude: number, longitude: number): Promise<RouteTrackingRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = now.split('T')[0]; // YYYY-MM-DD

    const sql = `
      INSERT INTO route_tracking (
        id, session_id, employee_id, latitude, longitude, timestamp,
        shipment_id, event_type, date, created_at, updated_at
      ) VALUES ($1, $2, (
        SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = $3 LIMIT 1
      ), $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, session_id, employee_id, latitude, longitude, timestamp, accuracy, speed, event_type, shipment_id, date, fuel_efficiency, fuel_price, vehicle_type, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, created_at, updated_at
    `;

    const res = await db.query(sql, [
      id, sessionId, sessionId,
      latitude, longitude, now,
      shipmentId, eventType,
      date, now, now
    ]);

    return res.rows[0] as RouteTrackingRecord;
  }

  async getRouteTrackingById(id: string): Promise<RouteTrackingRecord | null> {
    const sql = `
      SELECT id, session_id, employee_id, latitude, longitude, timestamp,
             accuracy, speed, event_type, shipment_id, date, fuel_efficiency, fuel_price, vehicle_type,
             total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed,
             created_at, updated_at
      FROM route_tracking WHERE id = $1
    `;
    const res = await db.query(sql, [id]);
    return res.rows[0] as RouteTrackingRecord || null;
  }

  async getActiveSession(employeeId: string): Promise<RouteSessionRecord | null> {
    try {
      console.log(`🔍 Getting active session for employee: ${employeeId}`);

      // First check if the route_sessions table exists
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'route_sessions'
        );
      `);

      if (!tableCheck.rows[0]?.exists) {
        console.log('⚠️ route_sessions table does not exist');
        return null;
      }

      const sql = `
        SELECT DISTINCT id, employee_id, start_time, end_time, status, 
               start_latitude, start_longitude, end_latitude, end_longitude,
               total_distance, total_time, average_speed, fuel_consumed, fuel_cost,
               shipments_completed, fuel_efficiency, fuel_price, vehicle_type,
               created_at, updated_at
        FROM route_sessions 
        WHERE employee_id = $1 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      console.log('Executing query for active session...');
      const res = await db.query(sql, [employeeId]);
      console.log(`Found ${res.rows.length} active sessions`);

      return res.rows[0] as RouteSessionRecord || null;
    } catch (error) {
      console.error('❌ Error in getActiveSession:', error);
      throw error;
    }
  }

  async getSessionCoordinates(sessionId: string): Promise<RouteTrackingRecord[]> {
    const sql = `
      SELECT id, session_id, employee_id, latitude, longitude, timestamp,
             accuracy, speed, event_type, shipment_id, date, fuel_efficiency, fuel_price, vehicle_type,
             total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed,
             created_at, updated_at
      FROM route_tracking 
      WHERE session_id = $1
      ORDER BY timestamp ASC
    `;
    const res = await db.query(sql, [sessionId]);
    return res.rows as RouteTrackingRecord[];
  }

  async getSession(sessionId: string): Promise<{ session: RouteSessionRecord | null; coordinates: RouteTrackingRecord[]; }> {
    const s = await db.query('SELECT * FROM route_sessions WHERE id = $1', [sessionId]);
    const session = (s.rows[0] as RouteSessionRecord) || null;
    const coordsRes = await db.query('SELECT * FROM route_tracking WHERE session_id = $1 ORDER BY timestamp DESC', [sessionId]);
    return { session, coordinates: coordsRes.rows as RouteTrackingRecord[] };
  }

  async listRecentSessions(limit: number = 50): Promise<RouteSessionRecord[]> {
    const res = await db.query(
      'SELECT * FROM route_sessions ORDER BY start_time DESC LIMIT $1',
      [limit]
    );
    return res.rows as RouteSessionRecord[];
  }

  // Advanced Analytics
  async getRouteAnalytics(filters: RouteFilters = {}): Promise<RouteAnalytics[]> {
    let query = `
      SELECT employee_id as "employeeId", date,
             SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as "totalDistance",
             SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as "totalTime",
             AVG(CASE WHEN average_speed IS NOT NULL THEN average_speed ELSE 0 END) as "averageSpeed",
             SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as "fuelConsumed",
             SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as "fuelCost",
             SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as "shipmentsCompleted",
             CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
                  THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
                  ELSE 0 END as efficiency
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = $${params.length + 1}`;
      params.push(filters.employeeId);
    }

    if (filters.date) {
      query += ` AND date = $${params.length + 1}`;
      params.push(filters.date);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(filters.startDate, filters.endDate);
    }

    query += ` GROUP BY employee_id, date ORDER BY date DESC`;

    const res = await db.query(query, params);
    return res.rows as RouteAnalytics[];
  }

  async getEmployeePerformanceMetrics(filters: RouteFilters = {}): Promise<any[]> {
    let query = `
      SELECT 
        employee_id as "employeeId",
        COUNT(DISTINCT session_id) as "totalSessions",
        COUNT(DISTINCT date) as "workingDays",
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as "totalDistance",
        SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as "totalTime",
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as "totalFuelConsumed",
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as "totalFuelCost",
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as "totalShipmentsCompleted",
        AVG(CASE WHEN average_speed IS NOT NULL AND average_speed > 0 THEN average_speed ELSE NULL END) as "averageSpeed",
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        CASE WHEN COUNT(DISTINCT date) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / COUNT(DISTINCT date)
             ELSE 0 END as "averageDistancePerDay",
        CASE WHEN COUNT(DISTINCT date) > 0 
             THEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) / COUNT(DISTINCT date)
             ELSE 0 END as "averageShipmentsPerDay"
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = $${params.length + 1}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${params.length + 1}`;
      params.push(filters.date);
    }

    query += ` GROUP BY employee_id ORDER BY "totalDistance" DESC`;

    const res = await db.query(query, params);
    return res.rows;
  }

  async getRoutePerformanceMetrics(filters: RouteFilters = {}): Promise<any[]> {
    let query = `
      SELECT 
        employee_id as "routeIdentifier",
        COUNT(DISTINCT session_id) as "totalSessions",
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as "totalDistance",
        SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as "totalTime",
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as "totalShipments",
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as "fuelConsumed",
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as "fuelCost",
        AVG(CASE WHEN average_speed IS NOT NULL AND average_speed > 0 THEN average_speed ELSE NULL END) as "averageSpeed",
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        COUNT(DISTINCT employee_id) as "employeeCount"
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${params.length + 1}`;
      params.push(filters.date);
    }

    query += ` GROUP BY employee_id ORDER BY "totalDistance" DESC`;

    const res = await db.query(query, params);
    return res.rows;
  }

  async getTimeBasedMetrics(
    groupBy: 'day' | 'week' | 'month',
    filters: RouteFilters = {}
  ): Promise<any[]> {
    let dateGrouping: string;
    switch (groupBy) {
      case 'day':
        dateGrouping = 'date';
        break;
      case 'week':
        dateGrouping = "TO_CHAR(date::date, 'IYYY-IW')";
        break;
      case 'month':
        dateGrouping = "TO_CHAR(date::date, 'YYYY-MM')";
        break;
    }

    let query = `
      SELECT 
        ${dateGrouping} as period,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as "totalDistance",
        SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as "totalTime",
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as "totalShipments",
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as "totalFuelConsumed",
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as "totalFuelCost",
        AVG(CASE WHEN average_speed IS NOT NULL AND average_speed > 0 THEN average_speed ELSE NULL END) as "averageSpeed",
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        COUNT(DISTINCT employee_id) as "activeEmployees",
        COUNT(DISTINCT session_id) as "totalSessions"
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = $${params.length + 1}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${params.length + 1}`;
      params.push(filters.date);
    }

    query += ` GROUP BY ${dateGrouping} ORDER BY period DESC`;

    const res = await db.query(query, params);
    return res.rows;
  }

  async getFuelAnalytics(filters: RouteFilters = {}): Promise<any> {
    let query = `
      SELECT 
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as "totalFuelConsumed",
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as "totalFuelCost",
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as "totalDistance",
        AVG(fuel_efficiency) as "averageFuelEfficiency",
        AVG(fuel_price) as "averageFuelPrice",
        COUNT(DISTINCT employee_id) as "employeeCount",
        COUNT(DISTINCT session_id) as "sessionCount"
      FROM route_tracking
      WHERE fuel_consumed IS NOT NULL AND fuel_consumed > 0
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = $${params.length + 1}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${params.length + 1}`;
      params.push(filters.date);
    }

    const result = await db.query(query, params);

    // Get breakdown by employee
    let employeeQuery = `
      SELECT 
        employee_id as "employeeId",
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as "fuelConsumed",
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as "fuelCost",
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as distance,
        AVG(fuel_efficiency) as efficiency
      FROM route_tracking
      WHERE fuel_consumed IS NOT NULL AND fuel_consumed > 0
    `;

    if (filters.employeeId) {
      employeeQuery += ` AND employee_id = $${params.length + 1}`;
    }

    if (filters.startDate && filters.endDate) {
      employeeQuery += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
    } else if (filters.date) {
      employeeQuery += ` AND date = $${params.length + 1}`;
    }

    employeeQuery += ` GROUP BY employee_id`;

    const employeeBreakdown = await db.query(employeeQuery, params);

    // Get breakdown by vehicle type
    let vehicleQuery = `
      SELECT 
        vehicle_type as "vehicleType",
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as "fuelConsumed",
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as "fuelCost",
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as distance,
        AVG(fuel_efficiency) as efficiency
      FROM route_tracking
      WHERE fuel_consumed IS NOT NULL AND fuel_consumed > 0
    `;

    if (filters.employeeId) {
      vehicleQuery += ` AND employee_id = $${params.length + 1}`;
    }

    if (filters.startDate && filters.endDate) {
      vehicleQuery += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
    } else if (filters.date) {
      vehicleQuery += ` AND date = $${params.length + 1}`;
    }

    vehicleQuery += ` GROUP BY vehicle_type`;

    const vehicleBreakdown = await db.query(vehicleQuery, params);

    return {
      ...result.rows[0],
      byEmployee: employeeBreakdown.rows,
      byVehicleType: vehicleBreakdown.rows
    };
  }

  async getHourlyActivityData(filters: RouteFilters = {}): Promise<any[]> {
    let query = `
      SELECT 
        EXTRACT(HOUR FROM timestamp::timestamp) as hour,
        COUNT(*) as activity,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT employee_id) as employees
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = $${params.length + 1}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${params.length + 1}`;
      params.push(filters.date);
    }

    query += ` GROUP BY EXTRACT(HOUR FROM timestamp::timestamp) ORDER BY hour`;

    const res = await db.query(query, params);
    return res.rows;
  }

  async getTopPerformers(metric: 'distance' | 'efficiency' | 'fuel', limit: number = 10): Promise<any[]> {
    let orderBy: string;
    switch (metric) {
      case 'distance':
        orderBy = '"totalDistance" DESC';
        break;
      case 'efficiency':
        orderBy = 'efficiency DESC';
        break;
      case 'fuel':
        orderBy = '"fuelEfficiency" DESC';
        break;
    }

    const query = `
      SELECT 
        employee_id as "employeeId",
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as "totalDistance",
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as "totalShipments",
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        CASE WHEN SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END)
             ELSE 0 END as "fuelEfficiency",
        COUNT(DISTINCT date) as "workingDays"
      FROM route_tracking
      WHERE total_distance IS NOT NULL AND total_distance > 0
      GROUP BY employee_id
      ORDER BY ${orderBy}
      LIMIT $1
    `;

    const res = await db.query(query, [limit]);
    return res.rows;
  }

  // Calculate and update analytics for completed sessions
  async updateSessionAnalytics(sessionId: string): Promise<void> {
    try {
      // Get all coordinates for the session
      const coordinates = await this.getSessionCoordinates(sessionId);

      if (coordinates.length < 2) {
        return;
      }

      // Calculate total distance using Haversine formula
      let totalDistance = 0;
      for (let i = 1; i < coordinates.length; i++) {
        const prev = coordinates[i - 1];
        const curr = coordinates[i];
        const distance = this.calculateHaversineDistance(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude
        );
        totalDistance += distance;
      }

      // Calculate time and speed
      const startTime = new Date(coordinates[0].timestamp);
      const endTime = new Date(coordinates[coordinates.length - 1].timestamp);
      const totalTime = Math.max(1, (endTime.getTime() - startTime.getTime()) / 1000); // seconds
      const averageSpeed = (totalDistance / (totalTime / 3600)); // km/h

      // Count completed shipments
      const shipmentsCompleted = new Set(
        coordinates
          .filter(coord => coord.shipment_id && coord.event_type)
          .map(coord => coord.shipment_id)
      ).size;

      // Get fuel settings from first coordinate
      const fuelEfficiency = coordinates[0].fuel_efficiency || 15.0;
      const fuelPrice = coordinates[0].fuel_price || 1.5;

      // Calculate fuel consumption
      const fuelConsumed = totalDistance / fuelEfficiency;
      const fuelCost = fuelConsumed * fuelPrice;

      // Update all coordinates in the session with calculated analytics
      const updateStmt = `
        UPDATE route_tracking 
        SET total_distance = $1, total_time = $2, average_speed = $3, 
            fuel_consumed = $4, fuel_cost = $5, shipments_completed = $6,
            updated_at = NOW()
        WHERE session_id = $7
      `;

      await db.query(updateStmt, [
        Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
        totalTime,
        Math.round(averageSpeed * 100) / 100, // Round to 2 decimal places
        Math.round(fuelConsumed * 100) / 100,
        Math.round(fuelCost * 100) / 100,
        shipmentsCompleted,
        sessionId
      ]);

      console.log(`Updated analytics for session ${sessionId}: ${totalDistance.toFixed(1)}km, ${shipmentsCompleted} shipments`);

    } catch (error) {
      console.error(`Failed to update analytics for session ${sessionId}:`, error);
    }
  }

  // Calculate distance between two points using Haversine formula
  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Cleanup and Maintenance
  async cleanupOldRouteData(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    await db.query('DELETE FROM route_tracking WHERE date < $1', [cutoffIso]);
  }

  async getAnalyticsSummary(): Promise<{ totalRoutes: number; totalDistance: number; totalTimeHours: number; shipmentsCompleted: number; }> {
    const totalRoutesRes = await db.query('SELECT COUNT(*)::int as c FROM route_sessions');
    const totalDistanceRes = await db.query('SELECT COALESCE(SUM(total_distance),0)::float as d FROM route_sessions');
    const totalTimeRes = await db.query('SELECT COALESCE(SUM(total_time),0)::int as t FROM route_sessions');
    const completedRes = await db.query(`SELECT COALESCE(SUM(shipments_completed),0)::int as s FROM (
      SELECT COUNT(*) as shipments_completed FROM route_tracking WHERE event_type IN ('delivery','pickup') GROUP BY session_id
    ) x`);
    return {
      totalRoutes: totalRoutesRes.rows[0]?.c || 0,
      totalDistance: totalDistanceRes.rows[0]?.d || 0,
      totalTimeHours: Math.round(((totalTimeRes.rows[0]?.t || 0) / 3600)),
      shipmentsCompleted: completedRes.rows[0]?.s || 0,
    };
  }

  async insertCoordinatesBatch(coordinates: Array<{ sessionId: string; employeeId: string; latitude: number; longitude: number; accuracy?: number; speed?: number; timestamp?: string; eventType?: string; shipmentId?: string; }>): Promise<{ success: number; failed: number; }> {
    let success = 0;
    let failed = 0;
    for (const c of coordinates) {
      try {
        await this.insertCoordinate(c);
        success++;
      } catch {
        failed++;
      }
    }
    return { success, failed };
  }
}

export const routeService = new RouteService();


