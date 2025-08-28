import { liveDb, replicaDb } from './connection.js';
import { Shipment, InsertShipment, UpdateShipment, Acknowledgment, InsertAcknowledgment, DashboardMetrics, ShipmentFilters } from '@shared/schema';
import { randomUUID } from 'crypto';

export class ShipmentQueries {
  private db: any;

  constructor(useReplica = false) {
    this.db = useReplica ? replicaDb : liveDb;
  }

  getAllShipments(filters: ShipmentFilters = {}): Shipment[] {
    let query = `
      SELECT * FROM shipments 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }

    if (filters.routeName) {
      query += ` AND routeName = ?`;
      params.push(filters.routeName);
    }

    if (filters.date) {
      query += ` AND DATE(deliveryTime) = ?`;
      params.push(filters.date);
    }

    query += ` ORDER BY createdAt DESC`;

    return this.db.prepare(query).all(...params);
  }

  getShipmentById(id: string): Shipment | null {
    return this.db.prepare('SELECT * FROM shipments WHERE id = ?').get(id) || null;
  }

  createShipment(shipment: InsertShipment): Shipment {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO shipments (
        id, type, customerName, customerMobile, address, 
        cost, deliveryTime, routeName, employeeId, status, 
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, shipment.type, shipment.customerName, shipment.customerMobile,
      shipment.address, shipment.cost, shipment.deliveryTime,
      shipment.routeName, shipment.employeeId, shipment.status || 'Assigned',
      now, now
    );

    // Also insert into replica
    if (this.db === liveDb) {
      const replicaQueries = new ShipmentQueries(true);
      const replicaStmt = replicaDb.prepare(`
        INSERT INTO shipments (
          id, type, customerName, customerMobile, address, 
          cost, deliveryTime, routeName, employeeId, status, 
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      replicaStmt.run(
        id, shipment.type, shipment.customerName, shipment.customerMobile,
        shipment.address, shipment.cost, shipment.deliveryTime,
        shipment.routeName, shipment.employeeId, shipment.status || 'Assigned',
        now, now
      );
    }

    return this.getShipmentById(id)!;
  }

  updateShipment(id: string, updates: UpdateShipment): Shipment | null {
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      UPDATE shipments 
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `);

    const result = stmt.run(updates.status, now, id);
    
    if (result.changes === 0) {
      return null;
    }

    // Also update replica if updating live db
    if (this.db === liveDb) {
      const replicaStmt = replicaDb.prepare(`
        UPDATE shipments 
        SET status = ?, updatedAt = ?
        WHERE id = ?
      `);
      replicaStmt.run(updates.status, now, id);
    }

    return this.getShipmentById(id);
  }

  batchUpdateShipments(updates: { id: string; status: string }[]): number {
    let totalUpdated = 0;
    
    this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE shipments 
        SET status = ?, updatedAt = ?
        WHERE id = ?
      `);

      const replicaStmt = replicaDb.prepare(`
        UPDATE shipments 
        SET status = ?, updatedAt = ?
        WHERE id = ?
      `);

      const now = new Date().toISOString();

      for (const update of updates) {
        const result = stmt.run(update.status, now, update.id);
        if (result.changes > 0) {
          totalUpdated++;
          // Also update replica
          replicaStmt.run(update.status, now, update.id);
        }
      }
    })();

    return totalUpdated;
  }

  getDashboardMetrics(): DashboardMetrics {
    const totalShipments = this.db.prepare('SELECT COUNT(*) as count FROM shipments').get().count;
    
    const statusStats = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM shipments 
      GROUP BY status
    `).all();

    const typeStats = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM shipments 
      GROUP BY type
    `).all();

    const routeStats = this.db.prepare(`
      SELECT 
        routeName,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'Picked Up' THEN 1 ELSE 0 END) as pickedUp,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'Assigned' AND type = 'pickup' THEN 1 ELSE 0 END) as pickupPending,
        SUM(CASE WHEN status = 'Assigned' AND type = 'delivery' THEN 1 ELSE 0 END) as deliveryPending
      FROM shipments 
      GROUP BY routeName
    `).all();

    const statusBreakdown: Record<string, number> = {};
    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    statusStats.forEach((stat: any) => {
      statusBreakdown[stat.status] = stat.count;
      if (stat.status === 'Delivered' || stat.status === 'Picked Up') {
        completed += stat.count;
      } else if (stat.status === 'In Transit') {
        inProgress += stat.count;
      } else if (stat.status === 'Assigned') {
        pending += stat.count;
      }
    });

    const typeBreakdown: Record<string, number> = {};
    typeStats.forEach((stat: any) => {
      typeBreakdown[stat.type] = stat.count;
    });

    const routeBreakdown: Record<string, any> = {};
    routeStats.forEach((stat: any) => {
      routeBreakdown[stat.routeName] = {
        total: stat.total,
        delivered: stat.delivered,
        pickedUp: stat.pickedUp,
        pending: stat.pending,
        cancelled: stat.cancelled,
        pickupPending: stat.pickupPending,
        deliveryPending: stat.deliveryPending,
      };
    });

    return {
      totalShipments,
      completed,
      inProgress,
      pending,
      statusBreakdown,
      typeBreakdown,
      routeBreakdown,
    };
  }

  createAcknowledgment(acknowledgment: InsertAcknowledgment): Acknowledgment {
    const id = randomUUID();
    
    const stmt = this.db.prepare(`
      INSERT INTO acknowledgments (
        id, shipmentId, signatureUrl, photoUrl, capturedAt
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, 
      acknowledgment.shipmentId, 
      acknowledgment.signatureUrl || null,
      acknowledgment.photoUrl || null,
      acknowledgment.capturedAt
    );

    return this.db.prepare('SELECT * FROM acknowledgments WHERE id = ?').get(id);
  }

  getAcknowledmentByShipmentId(shipmentId: string): Acknowledgment | null {
    return this.db.prepare('SELECT * FROM acknowledgments WHERE shipmentId = ?').get(shipmentId) || null;
  }

  resetDatabase(): void {
    this.db.exec('DELETE FROM acknowledgments');
    this.db.exec('DELETE FROM shipments');
  }

  cleanupOldData(daysToKeep: number = 3): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString();

    this.db.prepare('DELETE FROM acknowledgments WHERE capturedAt < ?').run(cutoffIso);
    this.db.prepare('DELETE FROM shipments WHERE createdAt < ?').run(cutoffIso);
  }
}
