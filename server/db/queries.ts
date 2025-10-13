import { liveDb, replicaDb } from './connection.js';
import { Shipment, InsertShipment, UpdateShipment, Acknowledgment, InsertAcknowledgment, DashboardMetrics, ShipmentFilters } from '@shared/schema';
import { randomUUID } from 'crypto';

export class ShipmentQueries {
  private db: any;

  constructor(useReplica = false) {
    this.db = useReplica ? replicaDb : liveDb;
  }

  getDatabase() {
    return this.db;
  }

  getAllShipments(filters: ShipmentFilters = {}): { data: Shipment[]; total: number } {
    // Base query for counting total records
    let countQuery = `
      SELECT COUNT(*) as total FROM shipments 
      WHERE 1=1
    `;

    // Base query for fetching data
    let dataQuery = `
      SELECT * FROM shipments 
      WHERE 1=1
    `;

    const params: any[] = [];

    // Apply filters
    if (filters.status) {
      const condition = ` AND status = ?`;
      countQuery += condition;
      dataQuery += condition;
      params.push(filters.status);
    }

    if (filters.type) {
      const condition = ` AND type = ?`;
      countQuery += condition;
      dataQuery += condition;
      params.push(filters.type);
    }

    if (filters.routeName) {
      const condition = ` AND routeName = ?`;
      countQuery += condition;
      dataQuery += condition;
      params.push(filters.routeName);
    }

    if (filters.date) {
      const condition = ` AND DATE(deliveryTime) = ?`;
      countQuery += condition;
      dataQuery += condition;
      params.push(filters.date);
    }

    if (filters.employeeId) {
      const condition = ` AND employeeId = ?`;
      countQuery += condition;
      dataQuery += condition;
      params.push(filters.employeeId);
    }

    // Apply sorting (default to newest first)
    const sortField = filters.sortField || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    dataQuery += ` ORDER BY ${sortField} ${sortOrder}`;

    // Apply pagination
    const page = Math.max(1, parseInt(filters.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit as string) || 20));
    const offset = (page - 1) * limit;

    dataQuery += ` LIMIT ? OFFSET ?`;
    const dataParams = [...params, limit, offset];

    // Get total count
    const totalResult = this.db.prepare(countQuery).get(...params);
    const total = totalResult?.total || 0;

    // Get paginated data
    const data = this.db.prepare(dataQuery).all(...dataParams);

    return { data, total };
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
        latitude, longitude, cost, deliveryTime, routeName, 
        employeeId, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Map schema fields to database fields
    const customerName = shipment.customerName || shipment.recipientName || 'Unknown Customer';
    const customerMobile = shipment.customerMobile || shipment.recipientPhone || '';
    const address = shipment.address || shipment.deliveryAddress || '';
    const cost = shipment.cost || 0;
    const deliveryTime = shipment.deliveryTime || shipment.estimatedDeliveryTime || now;
    const routeName = shipment.routeName || 'Default Route';
    const employeeId = shipment.employeeId || 'default';

    stmt.run(
      id, shipment.type, customerName, customerMobile,
      address, shipment.latitude || null, shipment.longitude || null,
      cost, deliveryTime, routeName,
      employeeId, shipment.status || 'Assigned', now, now
    );

    // Also insert into replica
    if (this.db === liveDb) {
      const replicaQueries = new ShipmentQueries(true);
      const replicaStmt = replicaDb.prepare(`
        INSERT INTO shipments (
          id, type, customerName, customerMobile, address, 
          latitude, longitude, cost, deliveryTime, routeName, 
          employeeId, status, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      replicaStmt.run(
        id, shipment.type, customerName, customerMobile,
        address, shipment.latitude || null, shipment.longitude || null,
        cost, deliveryTime, routeName,
        employeeId, shipment.status || 'Assigned', now, now
      );
    }

    return this.getShipmentById(id)!;
  }

  updateShipment(id: string, updates: UpdateShipment): Shipment | null {
    const now = new Date().toISOString();

    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updates.status);
    }

    if (updates.latitude !== undefined) {
      updateFields.push('latitude = ?');
      updateValues.push(updates.latitude);
    }

    if (updates.longitude !== undefined) {
      updateFields.push('longitude = ?');
      updateValues.push(updates.longitude);
    }

    if (updates.address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(updates.address);
    }

    if (updates.customerName !== undefined) {
      updateFields.push('customerName = ?');
      updateValues.push(updates.customerName);
    }

    if (updates.customerMobile !== undefined) {
      updateFields.push('customerMobile = ?');
      updateValues.push(updates.customerMobile);
    }

    // Always update the updatedAt field
    updateFields.push('updatedAt = ?');
    updateValues.push(now);

    // Add the ID for the WHERE clause
    updateValues.push(id);

    if (updateFields.length === 1) { // Only updatedAt field
      return this.getShipmentById(id);
    }

    const stmt = this.db.prepare(`
      UPDATE shipments 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...updateValues);

    if (result.changes === 0) {
      return null;
    }

    // Also update replica if updating live db
    if (this.db === liveDb) {
      const replicaStmt = replicaDb.prepare(`
        UPDATE shipments 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `);
      replicaStmt.run(...updateValues);
    }

    return this.getShipmentById(id);
  }

  batchUpdateShipments(updates: UpdateShipment[]): number {
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
        if (update.status) { // Only update if status is provided
          const result = stmt.run(update.status, now, update.id);
          if (result.changes > 0) {
            totalUpdated++;
            // Also update replica
            replicaStmt.run(update.status, now, update.id);
          }
        }
      }
    })();

    return totalUpdated;
  }

  getDashboardMetrics(): DashboardMetrics {
    // Initialize default values for when there's no data
    const defaultMetrics: DashboardMetrics = {
      totalShipments: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      statusBreakdown: {},
      typeBreakdown: {},
      routeBreakdown: {}
    };

    try {
      const totalShipmentsResult = this.db.prepare('SELECT COUNT(*) as count FROM shipments').get();
      const totalShipments = totalShipmentsResult ? totalShipmentsResult.count : 0;

      // If there are no shipments, return default metrics
      if (totalShipments === 0) {
        return defaultMetrics;
      }

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
        if (stat.routeName) { // Only add if routeName is not null/undefined
          routeBreakdown[stat.routeName] = {
            total: stat.total || 0,
            delivered: stat.delivered || 0,
            pickedUp: stat.pickedUp || 0,
            pending: stat.pending || 0,
            cancelled: stat.cancelled || 0,
            pickupPending: stat.pickupPending || 0,
            deliveryPending: stat.deliveryPending || 0,
          };
        }
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
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return defaultMetrics;
    }
  }

  createAcknowledgment(acknowledgment: InsertAcknowledgment): Acknowledgment {
    const id = randomUUID();

    const stmt = this.db.prepare(`
      INSERT INTO acknowledgments (
        id, shipmentId, signature, photo, timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      acknowledgment.shipmentId,
      acknowledgment.signature || null,
      acknowledgment.photo || null,
      acknowledgment.timestamp
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

    this.db.prepare('DELETE FROM acknowledgments WHERE timestamp < ?').run(cutoffIso);
    this.db.prepare('DELETE FROM shipments WHERE createdAt < ?').run(cutoffIso);
  }


}
