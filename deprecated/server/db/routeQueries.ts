import { pool } from './connection.js';
import { RouteTracking, RouteSession, GPSCoordinate, RouteAnalytics, RouteFilters } from '@shared/types';
import { randomUUID } from 'crypto';
import { log } from "../../shared/utils/logger.js";

interface UpdateSessionData {
  status?: string;
  endTime?: string;
  endLatitude?: number;
  endLongitude?: number;
}

interface PerformanceMetric {
  employeeId: string;
  totalSessions: number;
  workingDays: number;
  totalDistance: number;
  totalTime: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalShipmentsCompleted: number;
  averageSpeed: number;
  efficiency: number;
  averageDistancePerDay: number;
  averageShipmentsPerDay: number;
}

interface RoutePerformance {
  routeIdentifier: string;
  totalSessions: number;
  totalDistance: number;
  totalTime: number;
  totalShipments: number;
  fuelConsumed: number;
  fuelCost: number;
  averageSpeed: number;
  efficiency: number;
  employeeCount: number;
}

interface TimeBasedMetric {
  period: string;
  totalDistance: number;
  totalTime: number;
  totalShipments: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  averageSpeed: number;
  efficiency: number;
  activeEmployees: number;
  totalSessions: number;
}

interface FuelAnalyticsResult {
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalDistance: number;
  averageFuelEfficiency: number;
  averageFuelPrice: number;
  employeeCount: number;
  sessionCount: number;
  byEmployee: Array<{
    employeeId: string;
    fuelConsumed: number;
    fuelCost: number;
    distance: number;
    efficiency: number;
  }>;
  byVehicleType: Array<{
    vehicleType: string;
    fuelConsumed: number;
    fuelCost: number;
    distance: number;
    efficiency: number;
  }>;
}

interface HourlyActivity {
  hour: string;
  activity: number;
  sessions: number;
  employees: number;
}

interface TopPerformer {
  employeeId: string;
  totalDistance: number;
  totalShipments: number;
  efficiency: number;
  fuelEfficiency: number;
  workingDays: number;
}

export class RouteTrackingQueries {
  
  constructor() {
    // Pool is managed globally
  }

  // Get route session by ID
  async getRouteSession(sessionId: string): Promise<RouteSession | null> {
    const result = await pool.query(`
      SELECT DISTINCT session_id as id, employee_id as "employeeId", session_start_time as "startTime", 
             session_end_time as "endTime", session_status as status,
             start_latitude as "startLatitude", start_longitude as "startLongitude",
             end_latitude as "endLatitude", end_longitude as "endLongitude",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM route_tracking 
      WHERE session_id = $1
      LIMIT 1
    `, [sessionId]);

    return result.rows[0] || null;
  }

  // Update route session
  async updateRouteSession(sessionId: string, updateData: UpdateSessionData): Promise<RouteSession | null> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (updateData.status) {
      updates.push(`session_status = $${paramIndex++}`);
      values.push(updateData.status);
    }
    if (updateData.endTime) {
      updates.push(`session_end_time = $${paramIndex++}`);
      values.push(updateData.endTime);
    }
    if (updateData.endLatitude && updateData.endLongitude) {
      updates.push(`end_latitude = $${paramIndex++}, end_longitude = $${paramIndex++}`);
      values.push(updateData.endLatitude, updateData.endLongitude);
    }

    if (updates.length === 0) {
      return this.getRouteSession(sessionId);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(sessionId);

    const query = `
      UPDATE route_tracking 
      SET ${updates.join(', ')}
      WHERE session_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    return this.getRouteSession(sessionId);
  }

  // Route Session Management
  async createRouteSession(employeeId: string, startLatitude: number, startLongitude: number, id?: string): Promise<RouteSession> {
    const sessionId = id || randomUUID();
    const now = new Date().toISOString();
    const date = now.split('T')[0]; // YYYY-MM-DD

    // Create initial route tracking record for session start
    const trackingId = randomUUID();
    const query = `
      INSERT INTO route_tracking (
        id, session_id, employee_id, session_start_time, session_status,
        latitude, longitude, timestamp, start_latitude, start_longitude,
        date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    await pool.query(query, [
      trackingId, sessionId, employeeId, now, 'active',
      startLatitude, startLongitude, now, startLatitude, startLongitude,
      date, now, now
    ]);

    return {
      id: sessionId,
      employeeId,
      startTime: now,
      status: 'active',
      startLatitude,
      startLongitude,
      createdAt: now,
      updatedAt: now
    };
  }

  async stopRouteSession(sessionId: string, endLatitude: number, endLongitude: number): Promise<RouteSession | null> {
    const now = new Date().toISOString();

    // Update all records for this session with end time and location
    const query = `
      UPDATE route_tracking 
      SET session_end_time = $1, session_status = $2, end_latitude = $3, end_longitude = $4, updated_at = $5
      WHERE session_id = $6
    `;

    const result = await pool.query(query, [now, 'completed', endLatitude, endLongitude, now, sessionId]);

    if (result.rowCount === 0) {
      return null;
    }

    // Calculate and update analytics for the completed session
    await this.updateSessionAnalytics(sessionId);

    // Get the updated session info
    const sessionResult = await pool.query(`
      SELECT DISTINCT session_id as id, employee_id as "employeeId", session_start_time as "startTime", 
             session_end_time as "endTime", session_status as status,
             start_latitude as "startLatitude", start_longitude as "startLongitude",
             end_latitude as "endLatitude", end_longitude as "endLongitude",
             total_distance as "totalDistance",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM route_tracking 
      WHERE session_id = $1
      LIMIT 1
    `, [sessionId]);

    return sessionResult.rows[0] || null;
  }

  // GPS Coordinate Recording
  async recordGPSCoordinate(coordinate: GPSCoordinate): Promise<RouteTracking> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = coordinate.timestamp.split('T')[0]; // YYYY-MM-DD

    const query = `
      INSERT INTO route_tracking (
        id, session_id, employee_id, latitude, longitude, timestamp, 
        accuracy, speed, date, created_at, updated_at
      ) VALUES ($1, $2, (
        SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = $3 LIMIT 1
      ), $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    await pool.query(query, [
      id, coordinate.sessionId, coordinate.sessionId,
      coordinate.latitude, coordinate.longitude, coordinate.timestamp,
      coordinate.accuracy || null, coordinate.speed || null,
      date, now, now
    ]);

    return (await this.getRouteTrackingById(id))!;
  }

  // Shipment Event Recording
  async recordShipmentEvent(sessionId: string, shipmentId: string, eventType: 'pickup' | 'delivery', latitude: number, longitude: number): Promise<RouteTracking> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = now.split('T')[0]; // YYYY-MM-DD

    const query = `
      INSERT INTO route_tracking (
        id, session_id, employee_id, latitude, longitude, timestamp,
        shipment_id, event_type, date, created_at, updated_at
      ) VALUES ($1, $2, (
        SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = $3 LIMIT 1
      ), $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await pool.query(query, [
      id, sessionId, sessionId,
      latitude, longitude, now,
      shipmentId, eventType,
      date, now, now
    ]);

    return (await this.getRouteTrackingById(id))!;
  }

  // Data Retrieval
  async getRouteTrackingById(id: string): Promise<RouteTracking | null> {
    const result = await pool.query(`
      SELECT id, session_id as "sessionId", employee_id as "employeeId",
             session_start_time as "sessionStartTime", session_end_time as "sessionEndTime",
             session_status as "sessionStatus", latitude, longitude, timestamp,
             accuracy, speed, start_latitude as "startLatitude", start_longitude as "startLongitude",
             end_latitude as "endLatitude", end_longitude as "endLongitude",
             shipment_id as "shipmentId", event_type as "eventType",
             total_distance as "totalDistance", total_time as "totalTime",
             average_speed as "averageSpeed", fuel_consumed as "fuelConsumed",
             fuel_cost as "fuelCost", shipments_completed as "shipmentsCompleted",
             fuel_efficiency as "fuelEfficiency", fuel_price as "fuelPrice",
             vehicle_type as "vehicleType", date, created_at as "createdAt", updated_at as "updatedAt"
      FROM route_tracking WHERE id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  async getActiveSession(employeeId: string): Promise<RouteSession | null> {
    const result = await pool.query(`
      SELECT DISTINCT session_id as id, employee_id as "employeeId", 
             session_start_time as "startTime", session_end_time as "endTime",
             session_status as status, start_latitude as "startLatitude", 
             start_longitude as "startLongitude", end_latitude as "endLatitude", 
             end_longitude as "endLongitude", created_at as "createdAt", updated_at as "updatedAt"
      FROM route_tracking 
      WHERE employee_id = $1 AND session_status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `, [employeeId]);

    return result.rows[0] || null;
  }

  async getSessionCoordinates(sessionId: string): Promise<RouteTracking[]> {
    const result = await pool.query(`
      SELECT id, session_id as "sessionId", employee_id as "employeeId",
             session_start_time as "sessionStartTime", session_end_time as "sessionEndTime",
             session_status as "sessionStatus", latitude, longitude, timestamp,
             accuracy, speed, start_latitude as "startLatitude", start_longitude as "startLongitude",
             end_latitude as "endLatitude", end_longitude as "endLongitude",
             shipment_id as "shipmentId", event_type as "eventType",
             total_distance as "totalDistance", total_time as "totalTime",
             average_speed as "averageSpeed", fuel_consumed as "fuelConsumed",
             fuel_cost as "fuelCost", shipments_completed as "shipmentsCompleted",
             fuel_efficiency as "fuelEfficiency", fuel_price as "fuelPrice",
             vehicle_type as "vehicleType", date, created_at as "createdAt", updated_at as "updatedAt"
      FROM route_tracking 
      WHERE session_id = $1
      ORDER BY timestamp ASC
    `, [sessionId]);

    return result.rows;
  }

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
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.employeeId) {
      query += ` AND employee_id = $${paramIndex++}`;
      params.push(filters.employeeId);
    }

    if (filters.date) {
      query += ` AND date = $${paramIndex++}`;
      params.push(filters.date);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.startDate, filters.endDate);
    }

    query += ` GROUP BY employee_id, date ORDER BY date DESC`;

    const result = await pool.query(query, params);
    return result.rows;
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
          .filter(coord => coord.shipmentId && coord.eventType)
          .map(coord => coord.shipmentId)
      ).size;

      // Get fuel settings from first coordinate
      const fuelEfficiency = coordinates[0].fuelEfficiency || 15.0;
      const fuelPrice = coordinates[0].fuelPrice || 1.5;

      // Calculate fuel consumption
      const fuelConsumed = totalDistance / fuelEfficiency;
      const fuelCost = fuelConsumed * fuelPrice;

      // Update all coordinates in the session with calculated analytics
      const query = `
        UPDATE route_tracking 
        SET total_distance = $1, total_time = $2, average_speed = $3, 
            fuel_consumed = $4, fuel_cost = $5, shipments_completed = $6,
            updated_at = $7
        WHERE session_id = $8
      `;

      const now = new Date().toISOString();
      await pool.query(query, [
        Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
        totalTime,
        Math.round(averageSpeed * 100) / 100, // Round to 2 decimal places
        Math.round(fuelConsumed * 100) / 100,
        Math.round(fuelCost * 100) / 100,
        shipmentsCompleted,
        now,
        sessionId
      ]);

      log.dev(`Updated analytics for session ${sessionId}: ${totalDistance.toFixed(1)}km, ${shipmentsCompleted} shipments`);

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

  // Advanced Analytics Queries

  async getEmployeePerformanceMetrics(filters: RouteFilters = {}): Promise<PerformanceMetric[]> {
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
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.employeeId) {
      query += ` AND employee_id = $${paramIndex++}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${paramIndex++}`;
      params.push(filters.date);
    }

    query += ` GROUP BY employee_id ORDER BY "totalDistance" DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getRoutePerformanceMetrics(filters: RouteFilters = {}): Promise<RoutePerformance[]> {
    // Since we don't have route names in the current schema, we'll group by employee for now
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
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${paramIndex++}`;
      params.push(filters.date);
    }

    query += ` GROUP BY employee_id ORDER BY "totalDistance" DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getTimeBasedMetrics(
    groupBy: 'day' | 'week' | 'month',
    filters: RouteFilters = {}
  ): Promise<TimeBasedMetric[]> {
    let dateGrouping: string;
    switch (groupBy) {
      case 'day':
        dateGrouping = 'date';
        break;
      case 'week':
        dateGrouping = "to_char(date, 'IYYY-\"W\"IW')";
        break;
      case 'month':
        dateGrouping = "to_char(date, 'YYYY-MM')";
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
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.employeeId) {
      query += ` AND employee_id = $${paramIndex++}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${paramIndex++}`;
      params.push(filters.date);
    }

    query += ` GROUP BY ${dateGrouping} ORDER BY period DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getFuelAnalytics(filters: RouteFilters = {}): Promise<FuelAnalyticsResult | undefined> {
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
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.employeeId) {
      query += ` AND employee_id = $${paramIndex++}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${paramIndex++}`;
      params.push(filters.date);
    }

    const result = await pool.query(query, params);
    const mainResult = result.rows[0];
    
    if (!mainResult) return undefined;

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

    const employeeParams: (string | number)[] = [];
    let employeeParamIndex = 1;

    if (filters.employeeId) {
      employeeQuery += ` AND employee_id = $${employeeParamIndex++}`;
      employeeParams.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      employeeQuery += ` AND date BETWEEN $${employeeParamIndex++} AND $${employeeParamIndex++}`;
      employeeParams.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      employeeQuery += ` AND date = $${employeeParamIndex++}`;
      employeeParams.push(filters.date);
    }

    employeeQuery += ` GROUP BY employee_id`;

    const employeeResult = await pool.query(employeeQuery, employeeParams);
    const employeeBreakdown = employeeResult.rows;

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

    const vehicleParams: (string | number)[] = [];
    let vehicleParamIndex = 1;

    if (filters.employeeId) {
      vehicleQuery += ` AND employee_id = $${vehicleParamIndex++}`;
      vehicleParams.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      vehicleQuery += ` AND date BETWEEN $${vehicleParamIndex++} AND $${vehicleParamIndex++}`;
      vehicleParams.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      vehicleQuery += ` AND date = $${vehicleParamIndex++}`;
      vehicleParams.push(filters.date);
    }

    vehicleQuery += ` GROUP BY vehicle_type`;

    const vehicleResult = await pool.query(vehicleQuery, vehicleParams);
    const vehicleBreakdown = vehicleResult.rows;

    return {
      totalFuelConsumed: mainResult.totalFuelConsumed || 0,
      totalFuelCost: mainResult.totalFuelCost || 0,
      totalDistance: mainResult.totalDistance || 0,
      averageFuelEfficiency: mainResult.averageFuelEfficiency || 0,
      averageFuelPrice: mainResult.averageFuelPrice || 0,
      employeeCount: mainResult.employeeCount || 0,
      sessionCount: mainResult.sessionCount || 0,
      byEmployee: employeeBreakdown,
      byVehicleType: vehicleBreakdown
    };
  }

  async getHourlyActivityData(filters: RouteFilters = {}): Promise<HourlyActivity[]> {
    let query = `
      SELECT 
        to_char(timestamp, 'HH24') as hour,
        COUNT(*) as activity,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT employee_id) as employees
      FROM route_tracking
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.employeeId) {
      query += ` AND employee_id = $${paramIndex++}`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = $${paramIndex++}`;
      params.push(filters.date);
    }

    query += ` GROUP BY to_char(timestamp, 'HH24') ORDER BY hour`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getTopPerformers(metric: 'distance' | 'efficiency' | 'fuel', limit: number = 10): Promise<TopPerformer[]> {
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

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // Cleanup and Maintenance
  async cleanupOldRouteData(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    await pool.query('DELETE FROM route_tracking WHERE date < $1', [cutoffIso]);
  }

}