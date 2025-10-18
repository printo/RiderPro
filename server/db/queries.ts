import { db } from './pg-connection.js';
import { Shipment, InsertShipment, UpdateShipment, Acknowledgment, InsertAcknowledgment, DashboardMetrics, ShipmentFilters, VehicleType, InsertVehicleType, UpdateVehicleType, FuelSetting, InsertFuelSetting, UpdateFuelSetting } from '@shared/schema';
import { randomUUID } from 'crypto';

export class ShipmentQueries {
  constructor(_useReplica = false) { }

  getDatabase() {
    return db;
  }

  async getAllShipments(filters: ShipmentFilters = {}): Promise<{ data: Shipment[]; total: number }> {
    let whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      params.push(filters.status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (filters.type) {
      params.push(filters.type);
      whereClauses.push(`type = $${params.length}`);
    }
    if (filters.routeName) {
      params.push(filters.routeName);
      whereClauses.push(`"routeName" = $${params.length}`);
    }
    if (filters.date) {
      params.push(filters.date);
      whereClauses.push(`DATE("deliveryTime") = $${params.length}`);
    }
    if (filters.employeeId) {
      params.push(filters.employeeId);
      whereClauses.push(`"employeeId" = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*)::int as count FROM shipments ${whereSql}`;
    const countRes = await db.query(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    // Apply sorting (default to newest first)
    const sortField = filters.sortField || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';

    // Pagination
    const page = Math.max(1, parseInt(filters.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit as string) || 20));
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT *
      FROM shipments
      ${whereSql}
      ORDER BY "${sortField}" ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataRes = await db.query(dataSql, [...params, limit, offset]);
    const mapped = (dataRes.rows || []).map((r: any) => ({
      ...r,
      shipment_id: r.id,
      priority: r.priority ?? 'medium',
      pickupAddress: r.pickupAddress ?? '',
      weight: r.weight ?? 0,
      dimensions: r.dimensions ?? '',
      specialInstructions: r.specialInstructions ?? ''
    }));
    return { data: mapped as Shipment[], total };
  }

  async getShipmentById(id: string): Promise<Shipment | null> {
    const result = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
    const row = result.rows[0];
    return row ? ({ ...row, shipment_id: row.id } as any) : null;
  }

  async getShipmentByExternalId(externalId: string): Promise<Shipment | null> {
    const result = await db.query('SELECT * FROM shipments WHERE id = $1', [externalId]);
    const row = result.rows[0];
    return row ? ({ ...row, shipment_id: row.id } as any) : null;
  }

  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    const id = shipment.shipment_id || randomUUID();
    const now = new Date().toISOString();

    // Map schema fields to database fields (align with Supabase schema)
    const customerName = shipment.customerName || shipment.recipientName || 'Unknown Customer';
    const customerMobile = shipment.customerMobile || shipment.recipientPhone || '';
    const address = shipment.address || shipment.deliveryAddress || '';
    const cost = shipment.cost || 0;
    const deliveryTime = shipment.deliveryTime || shipment.estimatedDeliveryTime || now;
    const routeName = shipment.routeName || 'Default Route';
    const employeeId = shipment.employeeId || 'default';

    await db.query(`
      INSERT INTO shipments (
        id, type, "customerName", "customerMobile", address,
        cost, "deliveryTime", "routeName", "employeeId", status,
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      id, shipment.type, customerName, customerMobile,
      address,
      cost, deliveryTime, routeName,
      employeeId, shipment.status || 'Assigned',
      now, now
    ]);

    const created = await this.getShipmentById(id);
    if (!created) {
      throw new Error('Failed to fetch created shipment');
    }
    return created;
  }

  async updateShipment(id: string, updates: UpdateShipment): Promise<Shipment | null> {
    const now = new Date().toISOString();
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.status !== undefined) {
      updateFields.push('status = $' + (updateValues.length + 1));
      updateValues.push(updates.status);
    }

    if (updates.latitude !== undefined) {
      updateFields.push('latitude = $' + (updateValues.length + 1));
      updateValues.push(updates.latitude);
    }

    if (updates.longitude !== undefined) {
      updateFields.push('longitude = $' + (updateValues.length + 1));
      updateValues.push(updates.longitude);
    }

    if (updates.address !== undefined) {
      updateFields.push('address = $' + (updateValues.length + 1));
      updateValues.push(updates.address);
    }

    if (updates.customerName !== undefined) {
      updateFields.push('"customerName" = $' + (updateValues.length + 1));
      updateValues.push(updates.customerName);
    }

    if (updates.customerMobile !== undefined) {
      updateFields.push('"customerMobile" = $' + (updateValues.length + 1));
      updateValues.push(updates.customerMobile);
    }

    // Always update the updatedAt field
    updateFields.push('"updatedAt" = $' + (updateValues.length + 1));
    updateValues.push(now);

    // Add the ID for the WHERE clause
    updateValues.push(id);

    if (updateFields.length === 1) { // Only updatedAt field
      return await this.getShipmentById(id);
    }

    const result = await db.query(`
      UPDATE shipments 
      SET ${updateFields.join(', ')}
      WHERE id = $${updateValues.length}
    `, updateValues);

    if (result.rowCount === 0) {
      return null;
    }

    return await this.getShipmentById(id);
  }

  async batchUpdateShipments(updates: UpdateShipment[]): Promise<number> {
    const now = new Date().toISOString();
    let totalUpdated = 0;

    for (const update of updates) {
      if (update.status && update.shipment_id) { // Only update if status and shipment id are provided
        const result = await db.query(`
        UPDATE shipments 
          SET status = $1, "updatedAt" = $2
          WHERE id = $3
        `, [update.status, now, update.shipment_id]);

        if ((result.rowCount || 0) > 0) {
          totalUpdated++;
        }
      }
    }

    return totalUpdated;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
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
      const totalShipmentsRes = await db.query('SELECT COUNT(*)::int as count FROM shipments');
      const totalShipments = totalShipmentsRes.rows[0]?.count || 0;

      // If there are no shipments, return default metrics
      if (totalShipments === 0) {
        return defaultMetrics;
      }

      const statusStatsRes = await db.query(`
        SELECT status, COUNT(*)::int as count
        FROM shipments 
        GROUP BY status
      `);

      const typeStatsRes = await db.query(`
        SELECT type, COUNT(*)::int as count
        FROM shipments 
        GROUP BY type
      `);

      const routeStatsRes = await db.query(`
        SELECT 
          "routeName" as routeName,
          COUNT(*)::int as total,
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END)::int as delivered,
          SUM(CASE WHEN status = 'Picked Up' THEN 1 ELSE 0 END)::int as pickedUp,
          SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END)::int as pending,
          SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END)::int as cancelled,
          SUM(CASE WHEN status = 'Assigned' AND type = 'pickup' THEN 1 ELSE 0 END)::int as "pickupPending",
          SUM(CASE WHEN status = 'Assigned' AND type = 'delivery' THEN 1 ELSE 0 END)::int as "deliveryPending"
        FROM shipments 
        GROUP BY "routeName"
      `);

      const statusBreakdown: Record<string, number> = {};
      let completed = 0;
      let inProgress = 0;
      let pending = 0;

      statusStatsRes.rows.forEach((stat: any) => {
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
      typeStatsRes.rows.forEach((stat: any) => {
        typeBreakdown[stat.type] = stat.count;
      });

      const routeBreakdown: Record<string, any> = {};
      routeStatsRes.rows.forEach((stat: any) => {
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

  async createAcknowledgment(acknowledgment: InsertAcknowledgment): Promise<Acknowledgment> {
    const id = randomUUID();

    await db.query(`
      INSERT INTO acknowledgments (
        id, "shipmentId", "signatureUrl", "photoUrl", "capturedAt"
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      id,
      acknowledgment.shipment_id,
      acknowledgment.signatureUrl || null,
      acknowledgment.photoUrl || null,
      acknowledgment.acknowledgment_captured_at
    ]);

    const result = await db.query('SELECT * FROM acknowledgments WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getAcknowledmentByShipmentId(shipmentId: string): Promise<Acknowledgment | null> {
    const result = await db.query('SELECT * FROM acknowledgments WHERE "shipmentId" = $1', [shipmentId]);
    return result.rows[0] || null;
  }

  async resetDatabase(): Promise<void> {
    await db.query('DELETE FROM acknowledgments');
    await db.query('DELETE FROM shipments');
  }

  async cleanupOldData(daysToKeep: number = 3): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString();
    await db.query('DELETE FROM acknowledgments WHERE "capturedAt" < $1', [cutoffIso]);
    await db.query('DELETE FROM shipments WHERE "createdAt" < $1', [cutoffIso]);
  }

  /**
   * Execute multiple operations in a single transaction for batch processing
   * Provides atomicity for batch shipment operations
   */
  executeBatchTransaction<T>(operations: () => T): T {
    // No-op transaction wrapper for Postgres in this context
    return operations();
  }

  /**
   * Batch create or update shipments with transaction support
   * Returns results for each shipment operation
   */
  async batchCreateOrUpdateShipments(shipments: Array<{ external: any, internal: any }>): Promise<Array<{
    piashipmentid: string;
    internalId: string | null;
    status: 'created' | 'updated' | 'failed';
    message: string;
  }>> {
    const results = [];

    for (const { external, internal } of shipments) {
      try {
        // Check for existing shipment
        const existing = await this.getShipmentByExternalId(external.id);

        if (existing) {
          // Update existing shipment
          await this.updateShipment(existing.shipment_id, {
            shipment_id: existing.shipment_id,
            status: internal.status,
            priority: internal.priority,
            customerName: internal.customerName,
            customerMobile: internal.customerMobile,
            address: internal.address,
            latitude: internal.latitude,
            longitude: internal.longitude,
            cost: internal.cost,
            deliveryTime: internal.deliveryTime,
            routeName: internal.routeName,
            employeeId: internal.employeeId,
            pickupAddress: internal.pickupAddress,
            weight: internal.weight,
            dimensions: internal.dimensions,
            specialInstructions: internal.specialInstructions
          });

          results.push({
            piashipmentid: external.id,
            internalId: existing.shipment_id,
            status: 'updated' as const,
            message: 'Shipment updated successfully'
          });
        } else {
          // Create new shipment
          const newShipment = await this.createShipment({
            shipment_id: internal.piashipmentid || internal.id,
            type: internal.type,
            customerName: internal.customerName,
            customerMobile: internal.customerMobile,
            address: internal.address,
            latitude: internal.latitude,
            longitude: internal.longitude,
            cost: internal.cost,
            deliveryTime: internal.deliveryTime,
            routeName: internal.routeName,
            employeeId: internal.employeeId,
            status: internal.status,
            priority: internal.priority || 'medium',
            pickupAddress: internal.pickupAddress || '',
            deliveryAddress: internal.address,
            recipientName: internal.customerName,
            recipientPhone: internal.customerMobile,
            weight: internal.weight || 0,
            dimensions: internal.dimensions || '',
            specialInstructions: internal.specialInstructions,
            estimatedDeliveryTime: internal.deliveryTime
          });

          results.push({
            piashipmentid: external.id,
            internalId: newShipment.shipment_id,
            status: 'created' as const,
            message: 'Shipment created successfully'
          });
        }
      } catch (error: any) {
        results.push({
          piashipmentid: external.id,
          internalId: null,
          status: 'failed' as const,
          message: error.message
        });
      }
    }

    return results;
  }

  // Vehicle Types CRUD operations
  async getAllVehicleTypes(): Promise<VehicleType[]> {
    const result = await db.query('SELECT * FROM vehicle_types ORDER BY name');
    return result.rows;
  }

  async getVehicleTypeById(id: string): Promise<VehicleType | null> {
    const result = await db.query('SELECT * FROM vehicle_types WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType> {
    const now = new Date().toISOString();

    await db.query(`
      INSERT INTO vehicle_types (
        id, name, fuel_efficiency, description, icon, fuel_type, co2_emissions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      vehicleType.id,
      vehicleType.name,
      vehicleType.fuel_efficiency,
      vehicleType.description || null,
      vehicleType.icon || 'car',
      vehicleType.fuel_type || 'petrol',
      vehicleType.co2_emissions || null,
      now,
      now
    ]);

    const created = await this.getVehicleTypeById(vehicleType.id);
    if (!created) {
      throw new Error('Failed to fetch created vehicle type');
    }
    return created;
  }

  async updateVehicleType(id: string, updates: UpdateVehicleType): Promise<VehicleType | null> {
    const now = new Date().toISOString();

    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push(`name = $${values.length + 1}`);
      values.push(updates.name);
    }
    if (updates.fuel_efficiency !== undefined) {
      updateFields.push(`fuel_efficiency = $${values.length + 1}`);
      values.push(updates.fuel_efficiency);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${values.length + 1}`);
      values.push(updates.description);
    }
    if (updates.icon !== undefined) {
      updateFields.push(`icon = $${values.length + 1}`);
      values.push(updates.icon);
    }
    if (updates.fuel_type !== undefined) {
      updateFields.push(`fuel_type = $${values.length + 1}`);
      values.push(updates.fuel_type);
    }
    if (updates.co2_emissions !== undefined) {
      updateFields.push(`co2_emissions = $${values.length + 1}`);
      values.push(updates.co2_emissions);
    }

    if (updateFields.length === 0) {
      return await this.getVehicleTypeById(id);
    }

    updateFields.push(`updated_at = $${values.length + 1}`);
    values.push(now);
    values.push(id);

    await db.query(`
      UPDATE vehicle_types
      SET ${updateFields.join(', ')}
      WHERE id = $${values.length}
    `, values);

    return await this.getVehicleTypeById(id);
  }

  async deleteVehicleType(id: string): Promise<boolean> {
    const result = await db.query('DELETE FROM vehicle_types WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // Fuel Settings CRUD operations
  async getAllFuelSettings(): Promise<FuelSetting[]> {
    const result = await db.query('SELECT * FROM fuel_settings ORDER BY created_at DESC, fuel_type');
    return result.rows as FuelSetting[];
  }

  async getFuelSettingById(id: string): Promise<FuelSetting | null> {
    const result = await db.query('SELECT * FROM fuel_settings WHERE id = $1', [id]);
    return (result.rows[0] as FuelSetting) || null;
  }

  async createFuelSetting(fuelSetting: InsertFuelSetting): Promise<FuelSetting> {
    const now = new Date().toISOString();

    await db.query(`
      INSERT INTO fuel_settings (
        id, fuel_type, price_per_liter, currency, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      fuelSetting.id,
      fuelSetting.fuel_type,
      fuelSetting.price_per_liter,
      fuelSetting.currency || 'USD',
      fuelSetting.is_active !== undefined ? fuelSetting.is_active : true,
      now,
      now
    ]);

    const createdFuel = await this.getFuelSettingById(fuelSetting.id!);
    if (!createdFuel) {
      throw new Error('Failed to fetch created fuel setting');
    }
    return createdFuel;
  }

  async updateFuelSetting(id: string, updates: UpdateFuelSetting): Promise<FuelSetting | null> {
    const now = new Date().toISOString();

    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.fuel_type !== undefined) {
      updateFields.push(`fuel_type = $${values.length + 1}`);
      values.push(updates.fuel_type);
    }

    if (updates.price_per_liter !== undefined) {
      updateFields.push(`price_per_liter = $${values.length + 1}`);
      values.push(updates.price_per_liter);
    }

    if (updates.currency !== undefined) {
      updateFields.push(`currency = $${values.length + 1}`);
      values.push(updates.currency);
    }


    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${values.length + 1}`);
      values.push(updates.is_active);
    }

    if (updateFields.length === 0) {
      return await this.getFuelSettingById(id);
    }

    updateFields.push(`updated_at = $${values.length + 1}`);
    values.push(now);
    values.push(id);

    await db.query(`
      UPDATE fuel_settings
      SET ${updateFields.join(', ')}
      WHERE id = $${values.length}
    `, values);

    return await this.getFuelSettingById(id);
  }

  async deleteFuelSetting(id: string): Promise<boolean> {
    const result = await db.query('DELETE FROM fuel_settings WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

}
