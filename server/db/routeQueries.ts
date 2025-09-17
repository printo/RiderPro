import { liveDb, replicaDb } from './connection.js';
import { RouteTracking, InsertRouteTracking, RouteSession, GPSCoordinate, RouteAnalytics, RouteFilters } from '@shared/schema';
import { randomUUID } from 'crypto';

export class RouteTrackingQueries {
  private db: any;

  constructor(useReplica = false) {
    this.db = useReplica ? replicaDb : liveDb;
  }

  // Public method to access database for WebSocket queries
  public getDatabase() {
    return this.db;
  }

  // Get route session by ID
  getRouteSession(sessionId: string): RouteSession | null {
    const stmt = this.db.prepare(`
      SELECT DISTINCT session_id as id, employee_id as employeeId, session_start_time as startTime, 
             session_end_time as endTime, session_status as status,
             start_latitude as startLatitude, start_longitude as startLongitude,
             end_latitude as endLatitude, end_longitude as endLongitude,
             created_at as createdAt, updated_at as updatedAt
      FROM route_tracking 
      WHERE session_id = ?
      LIMIT 1
    `);

    const result = stmt.get(sessionId);
    return result || null;
  }

  // Update route session
  updateRouteSession(sessionId: string, updateData: any): RouteSession | null {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.status) {
      updates.push('session_status = ?');
      values.push(updateData.status);
    }
    if (updateData.endTime) {
      updates.push('session_end_time = ?');
      values.push(updateData.endTime);
    }
    if (updateData.endLatitude && updateData.endLongitude) {
      updates.push('end_latitude = ?, end_longitude = ?');
      values.push(updateData.endLatitude, updateData.endLongitude);
    }

    if (updates.length === 0) {
      return this.getRouteSession(sessionId);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE route_tracking 
      SET ${updates.join(', ')}
      WHERE session_id = ?
    `);

    const result = stmt.run(...values);

    if (result.changes === 0) {
      return null;
    }

    // Also update replica
    if (this.db === liveDb) {
      const replicaStmt = replicaDb.prepare(`
        UPDATE route_tracking 
        SET ${updates.join(', ')}
        WHERE session_id = ?
      `);
      replicaStmt.run(...values);
    }

    return this.getRouteSession(sessionId);
  }

  // Route Session Management
  createRouteSession(employeeId: string, startLatitude: number, startLongitude: number): RouteSession {
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const date = now.split('T')[0]; // YYYY-MM-DD

    // Create initial route tracking record for session start
    const trackingId = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO route_tracking (
        id, session_id, employee_id, session_start_time, session_status,
        latitude, longitude, timestamp, start_latitude, start_longitude,
        date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trackingId, sessionId, employeeId, now, 'active',
      startLatitude, startLongitude, now, startLatitude, startLongitude,
      date, now, now
    );

    // Also insert into replica
    if (this.db === liveDb) {
      const replicaStmt = replicaDb.prepare(`
        INSERT INTO route_tracking (
          id, session_id, employee_id, session_start_time, session_status,
          latitude, longitude, timestamp, start_latitude, start_longitude,
          date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      replicaStmt.run(
        trackingId, sessionId, employeeId, now, 'active',
        startLatitude, startLongitude, now, startLatitude, startLongitude,
        date, now, now
      );
    }

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

  stopRouteSession(sessionId: string, endLatitude: number, endLongitude: number): RouteSession | null {
    const now = new Date().toISOString();

    // Update all records for this session with end time and location
    const stmt = this.db.prepare(`
      UPDATE route_tracking 
      SET session_end_time = ?, session_status = ?, end_latitude = ?, end_longitude = ?, updated_at = ?
      WHERE session_id = ?
    `);

    const result = stmt.run(now, 'completed', endLatitude, endLongitude, now, sessionId);

    if (result.changes === 0) {
      return null;
    }

    // Also update replica
    if (this.db === liveDb) {
      const replicaStmt = replicaDb.prepare(`
        UPDATE route_tracking 
        SET session_end_time = ?, session_status = ?, end_latitude = ?, end_longitude = ?, updated_at = ?
        WHERE session_id = ?
      `);
      replicaStmt.run(now, 'completed', endLatitude, endLongitude, now, sessionId);
    }

    // Calculate and update analytics for the completed session
    this.updateSessionAnalytics(sessionId);

    // Get the updated session info
    const sessionData = this.db.prepare(`
      SELECT DISTINCT session_id as id, employee_id as employeeId, session_start_time as startTime, 
             session_end_time as endTime, session_status as status,
             start_latitude as startLatitude, start_longitude as startLongitude,
             end_latitude as endLatitude, end_longitude as endLongitude,
             total_distance as totalDistance,
             created_at as createdAt, updated_at as updatedAt
      FROM route_tracking 
      WHERE session_id = ?
      LIMIT 1
    `).get(sessionId);

    return sessionData || null;
  }

  // GPS Coordinate Recording
  recordGPSCoordinate(coordinate: GPSCoordinate): RouteTracking {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = coordinate.timestamp.split('T')[0]; // YYYY-MM-DD

    const stmt = this.db.prepare(`
      INSERT INTO route_tracking (
        id, session_id, employee_id, latitude, longitude, timestamp, 
        accuracy, speed, date, created_at, updated_at
      ) VALUES (?, ?, (
        SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = ? LIMIT 1
      ), ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, coordinate.sessionId, coordinate.sessionId,
      coordinate.latitude, coordinate.longitude, coordinate.timestamp,
      coordinate.accuracy || null, coordinate.speed || null,
      date, now, now
    );

    // Also insert into replica
    if (this.db === liveDb) {
      const replicaStmt = replicaDb.prepare(`
        INSERT INTO route_tracking (
          id, session_id, employee_id, latitude, longitude, timestamp, 
          accuracy, speed, date, created_at, updated_at
        ) VALUES (?, ?, (
          SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = ? LIMIT 1
        ), ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      replicaStmt.run(
        id, coordinate.sessionId, coordinate.sessionId,
        coordinate.latitude, coordinate.longitude, coordinate.timestamp,
        coordinate.accuracy || null, coordinate.speed || null,
        date, now, now
      );
    }

    return this.getRouteTrackingById(id)!;
  }

  // Shipment Event Recording
  recordShipmentEvent(sessionId: string, shipmentId: string, eventType: 'pickup' | 'delivery', latitude: number, longitude: number): RouteTracking {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = now.split('T')[0]; // YYYY-MM-DD

    const stmt = this.db.prepare(`
      INSERT INTO route_tracking (
        id, session_id, employee_id, latitude, longitude, timestamp,
        shipment_id, event_type, date, created_at, updated_at
      ) VALUES (?, ?, (
        SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = ? LIMIT 1
      ), ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, sessionId, sessionId,
      latitude, longitude, now,
      shipmentId, eventType,
      date, now, now
    );

    // Also insert into replica
    if (this.db === liveDb) {
      const replicaStmt = replicaDb.prepare(`
        INSERT INTO route_tracking (
          id, session_id, employee_id, latitude, longitude, timestamp,
          shipment_id, event_type, date, created_at, updated_at
        ) VALUES (?, ?, (
          SELECT DISTINCT employee_id FROM route_tracking WHERE session_id = ? LIMIT 1
        ), ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      replicaStmt.run(
        id, sessionId, sessionId,
        latitude, longitude, now,
        shipmentId, eventType,
        date, now, now
      );
    }

    return this.getRouteTrackingById(id)!;
  }

  // Data Retrieval
  getRouteTrackingById(id: string): RouteTracking | null {
    const result = this.db.prepare(`
      SELECT id, session_id as sessionId, employee_id as employeeId,
             session_start_time as sessionStartTime, session_end_time as sessionEndTime,
             session_status as sessionStatus, latitude, longitude, timestamp,
             accuracy, speed, start_latitude as startLatitude, start_longitude as startLongitude,
             end_latitude as endLatitude, end_longitude as endLongitude,
             shipment_id as shipmentId, event_type as eventType,
             total_distance as totalDistance, total_time as totalTime,
             average_speed as averageSpeed, fuel_consumed as fuelConsumed,
             fuel_cost as fuelCost, shipments_completed as shipmentsCompleted,
             fuel_efficiency as fuelEfficiency, fuel_price as fuelPrice,
             vehicle_type as vehicleType, date, created_at as createdAt, updated_at as updatedAt
      FROM route_tracking WHERE id = ?
    `).get(id);

    return result || null;
  }

  getActiveSession(employeeId: string): RouteSession | null {
    const result = this.db.prepare(`
      SELECT DISTINCT session_id as id, employee_id as employeeId, 
             session_start_time as startTime, session_end_time as endTime,
             session_status as status, start_latitude as startLatitude, 
             start_longitude as startLongitude, end_latitude as endLatitude, 
             end_longitude as endLongitude, created_at as createdAt, updated_at as updatedAt
      FROM route_tracking 
      WHERE employee_id = ? AND session_status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(employeeId);

    return result || null;
  }

  getSessionCoordinates(sessionId: string): RouteTracking[] {
    return this.db.prepare(`
      SELECT id, session_id as sessionId, employee_id as employeeId,
             session_start_time as sessionStartTime, session_end_time as sessionEndTime,
             session_status as sessionStatus, latitude, longitude, timestamp,
             accuracy, speed, start_latitude as startLatitude, start_longitude as startLongitude,
             end_latitude as endLatitude, end_longitude as endLongitude,
             shipment_id as shipmentId, event_type as eventType,
             total_distance as totalDistance, total_time as totalTime,
             average_speed as averageSpeed, fuel_consumed as fuelConsumed,
             fuel_cost as fuelCost, shipments_completed as shipmentsCompleted,
             fuel_efficiency as fuelEfficiency, fuel_price as fuelPrice,
             vehicle_type as vehicleType, date, created_at as createdAt, updated_at as updatedAt
      FROM route_tracking 
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `).all(sessionId);
  }

  getRouteAnalytics(filters: RouteFilters = {}): RouteAnalytics[] {
    let query = `
      SELECT employee_id as employeeId, date,
             SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as totalDistance,
             SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as totalTime,
             AVG(CASE WHEN average_speed IS NOT NULL THEN average_speed ELSE 0 END) as averageSpeed,
             SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as fuelConsumed,
             SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as fuelCost,
             SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as shipmentsCompleted,
             CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
                  THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
                  ELSE 0 END as efficiency
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = ?`;
      params.push(filters.employeeId);
    }

    if (filters.date) {
      query += ` AND date = ?`;
      params.push(filters.date);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN ? AND ?`;
      params.push(filters.startDate, filters.endDate);
    }

    query += ` GROUP BY employee_id, date ORDER BY date DESC`;

    return this.db.prepare(query).all(...params);
  }

  // Calculate and update analytics for completed sessions
  updateSessionAnalytics(sessionId: string): void {
    try {
      // Get all coordinates for the session
      const coordinates = this.getSessionCoordinates(sessionId);

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
      const updateStmt = this.db.prepare(`
        UPDATE route_tracking 
        SET total_distance = ?, total_time = ?, average_speed = ?, 
            fuel_consumed = ?, fuel_cost = ?, shipments_completed = ?,
            updated_at = ?
        WHERE session_id = ?
      `);

      const now = new Date().toISOString();
      updateStmt.run(
        Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
        totalTime,
        Math.round(averageSpeed * 100) / 100, // Round to 2 decimal places
        Math.round(fuelConsumed * 100) / 100,
        Math.round(fuelCost * 100) / 100,
        shipmentsCompleted,
        now,
        sessionId
      );

      // Also update replica
      if (this.db === liveDb) {
        const replicaStmt = replicaDb.prepare(`
          UPDATE route_tracking 
          SET total_distance = ?, total_time = ?, average_speed = ?, 
              fuel_consumed = ?, fuel_cost = ?, shipments_completed = ?,
              updated_at = ?
          WHERE session_id = ?
        `);

        replicaStmt.run(
          Math.round(totalDistance * 1000) / 1000,
          totalTime,
          Math.round(averageSpeed * 100) / 100,
          Math.round(fuelConsumed * 100) / 100,
          Math.round(fuelCost * 100) / 100,
          shipmentsCompleted,
          now,
          sessionId
        );
      }

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

  // Advanced Analytics Queries

  getEmployeePerformanceMetrics(filters: RouteFilters = {}): any[] {
    let query = `
      SELECT 
        employee_id as employeeId,
        COUNT(DISTINCT session_id) as totalSessions,
        COUNT(DISTINCT date) as workingDays,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as totalDistance,
        SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as totalTime,
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as totalFuelConsumed,
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as totalFuelCost,
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as totalShipmentsCompleted,
        AVG(CASE WHEN average_speed IS NOT NULL AND average_speed > 0 THEN average_speed ELSE NULL END) as averageSpeed,
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        CASE WHEN COUNT(DISTINCT date) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / COUNT(DISTINCT date)
             ELSE 0 END as averageDistancePerDay,
        CASE WHEN COUNT(DISTINCT date) > 0 
             THEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) / COUNT(DISTINCT date)
             ELSE 0 END as averageShipmentsPerDay
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = ?`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN ? AND ?`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = ?`;
      params.push(filters.date);
    }

    query += ` GROUP BY employee_id ORDER BY totalDistance DESC`;

    return this.db.prepare(query).all(...params);
  }

  getRoutePerformanceMetrics(filters: RouteFilters = {}): any[] {
    // Since we don't have route names in the current schema, we'll group by employee for now
    let query = `
      SELECT 
        employee_id as routeIdentifier,
        COUNT(DISTINCT session_id) as totalSessions,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as totalDistance,
        SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as totalTime,
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as totalShipments,
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as fuelConsumed,
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as fuelCost,
        AVG(CASE WHEN average_speed IS NOT NULL AND average_speed > 0 THEN average_speed ELSE NULL END) as averageSpeed,
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        COUNT(DISTINCT employee_id) as employeeCount
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN ? AND ?`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = ?`;
      params.push(filters.date);
    }

    query += ` GROUP BY employee_id ORDER BY totalDistance DESC`;

    return this.db.prepare(query).all(...params);
  }

  getTimeBasedMetrics(
    groupBy: 'day' | 'week' | 'month',
    filters: RouteFilters = {}
  ): any[] {
    let dateGrouping: string;
    switch (groupBy) {
      case 'day':
        dateGrouping = 'date';
        break;
      case 'week':
        dateGrouping = "strftime('%Y-W%W', date)";
        break;
      case 'month':
        dateGrouping = "strftime('%Y-%m', date)";
        break;
    }

    let query = `
      SELECT 
        ${dateGrouping} as period,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as totalDistance,
        SUM(CASE WHEN total_time IS NOT NULL THEN total_time ELSE 0 END) as totalTime,
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as totalShipments,
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as totalFuelConsumed,
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as totalFuelCost,
        AVG(CASE WHEN average_speed IS NOT NULL AND average_speed > 0 THEN average_speed ELSE NULL END) as averageSpeed,
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        COUNT(DISTINCT employee_id) as activeEmployees,
        COUNT(DISTINCT session_id) as totalSessions
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = ?`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN ? AND ?`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = ?`;
      params.push(filters.date);
    }

    query += ` GROUP BY ${dateGrouping} ORDER BY period DESC`;

    return this.db.prepare(query).all(...params);
  }

  getFuelAnalytics(filters: RouteFilters = {}): any {
    let query = `
      SELECT 
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as totalFuelConsumed,
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as totalFuelCost,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as totalDistance,
        AVG(fuel_efficiency) as averageFuelEfficiency,
        AVG(fuel_price) as averageFuelPrice,
        COUNT(DISTINCT employee_id) as employeeCount,
        COUNT(DISTINCT session_id) as sessionCount
      FROM route_tracking
      WHERE fuel_consumed IS NOT NULL AND fuel_consumed > 0
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = ?`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN ? AND ?`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = ?`;
      params.push(filters.date);
    }

    const result = this.db.prepare(query).get(...params);

    // Get breakdown by employee
    let employeeQuery = `
      SELECT 
        employee_id as employeeId,
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as fuelConsumed,
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as fuelCost,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as distance,
        AVG(fuel_efficiency) as efficiency
      FROM route_tracking
      WHERE fuel_consumed IS NOT NULL AND fuel_consumed > 0
    `;

    if (filters.employeeId) {
      employeeQuery += ` AND employee_id = ?`;
    }

    if (filters.startDate && filters.endDate) {
      employeeQuery += ` AND date BETWEEN ? AND ?`;
    } else if (filters.date) {
      employeeQuery += ` AND date = ?`;
    }

    employeeQuery += ` GROUP BY employee_id`;

    const employeeBreakdown = this.db.prepare(employeeQuery).all(...params);

    // Get breakdown by vehicle type
    let vehicleQuery = `
      SELECT 
        vehicle_type as vehicleType,
        SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) as fuelConsumed,
        SUM(CASE WHEN fuel_cost IS NOT NULL THEN fuel_cost ELSE 0 END) as fuelCost,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as distance,
        AVG(fuel_efficiency) as efficiency
      FROM route_tracking
      WHERE fuel_consumed IS NOT NULL AND fuel_consumed > 0
    `;

    if (filters.employeeId) {
      vehicleQuery += ` AND employee_id = ?`;
    }

    if (filters.startDate && filters.endDate) {
      vehicleQuery += ` AND date BETWEEN ? AND ?`;
    } else if (filters.date) {
      vehicleQuery += ` AND date = ?`;
    }

    vehicleQuery += ` GROUP BY vehicle_type`;

    const vehicleBreakdown = this.db.prepare(vehicleQuery).all(...params);

    return {
      ...result,
      byEmployee: employeeBreakdown,
      byVehicleType: vehicleBreakdown
    };
  }

  getHourlyActivityData(filters: RouteFilters = {}): any[] {
    let query = `
      SELECT 
        strftime('%H', timestamp) as hour,
        COUNT(*) as activity,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT employee_id) as employees
      FROM route_tracking
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.employeeId) {
      query += ` AND employee_id = ?`;
      params.push(filters.employeeId);
    }

    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN ? AND ?`;
      params.push(filters.startDate, filters.endDate);
    } else if (filters.date) {
      query += ` AND date = ?`;
      params.push(filters.date);
    }

    query += ` GROUP BY strftime('%H', timestamp) ORDER BY hour`;

    return this.db.prepare(query).all(...params);
  }

  getTopPerformers(metric: 'distance' | 'efficiency' | 'fuel', limit: number = 10): any[] {
    let orderBy: string;
    switch (metric) {
      case 'distance':
        orderBy = 'totalDistance DESC';
        break;
      case 'efficiency':
        orderBy = 'efficiency DESC';
        break;
      case 'fuel':
        orderBy = 'fuelEfficiency DESC';
        break;
    }

    const query = `
      SELECT 
        employee_id as employeeId,
        SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) as totalDistance,
        SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) as totalShipments,
        CASE WHEN SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN shipments_completed IS NOT NULL THEN shipments_completed ELSE 0 END)
             ELSE 0 END as efficiency,
        CASE WHEN SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END) > 0 
             THEN SUM(CASE WHEN total_distance IS NOT NULL THEN total_distance ELSE 0 END) / SUM(CASE WHEN fuel_consumed IS NOT NULL THEN fuel_consumed ELSE 0 END)
             ELSE 0 END as fuelEfficiency,
        COUNT(DISTINCT date) as workingDays
      FROM route_tracking
      WHERE total_distance IS NOT NULL AND total_distance > 0
      GROUP BY employee_id
      ORDER BY ${orderBy}
      LIMIT ?
    `;

    return this.db.prepare(query).all(limit);
  }

  // Cleanup and Maintenance
  cleanupOldRouteData(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    this.db.prepare('DELETE FROM route_tracking WHERE date < ?').run(cutoffIso);
  }
}