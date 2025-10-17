import { db } from '../db/pg-connection.js';

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
}

class RouteService {
  async startSession(params: { id: string; employeeId: string; startLatitude: number; startLongitude: number; }): Promise<RouteSessionRecord> {
    const sql = `
      INSERT INTO route_sessions (
        id, employee_id, start_time, status, start_latitude, start_longitude, created_at, updated_at
      ) VALUES ($1,$2,NOW(),'active',$3,$4,NOW(),NOW())
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, created_at, updated_at
    `;
    const res = await db.query(sql, [params.id, params.employeeId, params.startLatitude, params.startLongitude]);
    return res.rows[0] as RouteSessionRecord;
  }

  async stopSession(params: { id: string; endLatitude: number; endLongitude: number; }): Promise<RouteSessionRecord | null> {
    const sql = `
      UPDATE route_sessions
      SET end_time = NOW(), end_latitude = $2, end_longitude = $3, status = 'completed', updated_at = NOW()
      WHERE id = $1
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, created_at, updated_at
    `;
    const res = await db.query(sql, [params.id, params.endLatitude, params.endLongitude]);
    return res.rows[0] || null;
  }

  async insertCoordinate(params: { sessionId: string; employeeId: string; latitude: number; longitude: number; accuracy?: number; speed?: number; timestamp?: string; eventType?: string; shipmentId?: string; }): Promise<RouteTrackingRecord> {
    const ts = params.timestamp || new Date().toISOString();
    const dateOnly = ts.slice(0, 10);
    const sql = `
      INSERT INTO route_tracking (
        session_id, employee_id, latitude, longitude, timestamp, accuracy, speed, event_type, shipment_id, date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, session_id, employee_id, latitude, longitude, timestamp, accuracy, speed, event_type, shipment_id, date, fuel_efficiency, fuel_price
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

  async insertCoordinatesBatch(coordinates: Array<{ sessionId: string; employeeId: string; latitude: number; longitude: number; accuracy?: number; speed?: number; timestamp?: string; eventType?: string; shipmentId?: string; }>): Promise<{ success: number; failed: number; }>{
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

  async getSession(sessionId: string): Promise<{ session: RouteSessionRecord | null; coordinates: RouteTrackingRecord[]; }>{
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

  async getAnalyticsSummary(): Promise<{ totalRoutes: number; totalDistance: number; totalTimeHours: number; shipmentsCompleted: number; }>{
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
}

export const routeService = new RouteService();


