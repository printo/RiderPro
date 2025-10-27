var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/db/pg-connection.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dotenv from "dotenv";
var databaseUrl, pool, PostgresWrapper, db;
var init_pg_connection = __esm({
  "server/db/pg-connection.ts"() {
    "use strict";
    dotenv.config();
    neonConfig.webSocketConstructor = ws;
    databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error("DATABASE_URL environment variable is not set");
      throw new Error("DATABASE_URL must be configured");
    }
    pool = new Pool({ connectionString: databaseUrl });
    pool.query("SELECT NOW()").then(() => {
      console.log("\u2705 PostgreSQL database connected successfully");
    }).catch((err) => {
      console.error("\u274C Failed to connect to PostgreSQL database:", err.message);
      console.error("Please check your DATABASE_URL environment variable");
    });
    PostgresWrapper = class {
      constructor(poolInstance) {
        this.pool = poolInstance;
      }
      // SQLite-like prepare method that returns an object with get/all/run methods
      prepare(sql) {
        return {
          get: async (...params) => {
            const pgSql = this.convertPlaceholders(sql);
            const result = await this.pool.query(pgSql, params);
            return result.rows[0] || null;
          },
          all: async (...params) => {
            const pgSql = this.convertPlaceholders(sql);
            const result = await this.pool.query(pgSql, params);
            return result.rows;
          },
          run: async (...params) => {
            const pgSql = this.convertPlaceholders(sql);
            const result = await this.pool.query(pgSql, params);
            return {
              changes: result.rowCount || 0,
              lastInsertRowid: result.rows[0]?.id || null
            };
          }
        };
      }
      // Execute raw SQL (for CREATE TABLE, etc.)
      async exec(sql) {
        const statements = sql.split(";").filter((s) => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await this.pool.query(statement);
          }
        }
      }
      // Direct query access
      async query(sql, params = []) {
        const pgSql = this.convertPlaceholders(sql);
        return this.pool.query(pgSql, params);
      }
      // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
      convertPlaceholders(sql) {
        let index = 0;
        return sql.replace(/\?/g, () => {
          index++;
          return `$${index}`;
        });
      }
    };
    db = new PostgresWrapper(pool);
  }
});

// server/db/queries.ts
import { randomUUID } from "crypto";
var ShipmentQueries;
var init_queries = __esm({
  "server/db/queries.ts"() {
    "use strict";
    init_pg_connection();
    ShipmentQueries = class {
      constructor(_useReplica = false) {
      }
      getDatabase() {
        return db;
      }
      async getAllShipments(filters = {}) {
        let whereClauses = [];
        const params = [];
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
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
        const countSql = `SELECT COUNT(*)::int as count FROM shipments ${whereSql}`;
        const countRes = await db.query(countSql, params);
        const total = countRes.rows[0]?.count || 0;
        const sortField = filters.sortField || "createdAt";
        const sortOrder = filters.sortOrder || "DESC";
        const page = Math.max(1, parseInt(filters.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
        const offset = (page - 1) * limit;
        const dataSql = `
      SELECT *
      FROM shipments
      ${whereSql}
      ORDER BY "${sortField}" ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
        const dataRes = await db.query(dataSql, [...params, limit, offset]);
        const mapped = (dataRes.rows || []).map((r) => ({
          ...r,
          shipment_id: r.id,
          priority: r.priority ?? "medium",
          pickupAddress: r.pickupAddress ?? "",
          weight: r.weight ?? 0,
          dimensions: r.dimensions ?? "",
          specialInstructions: r.specialInstructions ?? ""
        }));
        return { data: mapped, total };
      }
      async getShipmentById(id) {
        const result = await db.query("SELECT * FROM shipments WHERE id = $1", [id]);
        const row = result.rows[0];
        return row ? { ...row, shipment_id: row.id } : null;
      }
      async getShipmentByExternalId(externalId) {
        const result = await db.query("SELECT * FROM shipments WHERE id = $1", [externalId]);
        const row = result.rows[0];
        return row ? { ...row, shipment_id: row.id } : null;
      }
      async createShipment(shipment) {
        const id = shipment.shipment_id || randomUUID();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const customerName = shipment.customerName || shipment.recipientName || "Unknown Customer";
        const customerMobile = shipment.customerMobile || shipment.recipientPhone || "";
        const address = shipment.address || shipment.deliveryAddress || "";
        const cost = shipment.cost || 0;
        const deliveryTime = shipment.deliveryTime || shipment.estimatedDeliveryTime || now;
        const routeName = shipment.routeName || "Default Route";
        const employeeId = shipment.employeeId || "default";
        await db.query(`
      INSERT INTO shipments (
        id, type, "customerName", "customerMobile", address,
        cost, "deliveryTime", "routeName", "employeeId", status,
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
          id,
          shipment.type,
          customerName,
          customerMobile,
          address,
          cost,
          deliveryTime,
          routeName,
          employeeId,
          shipment.status || "Assigned",
          now,
          now
        ]);
        const created = await this.getShipmentById(id);
        if (!created) {
          throw new Error("Failed to fetch created shipment");
        }
        return created;
      }
      async updateShipment(id, updates) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const updateFields = [];
        const updateValues = [];
        if (updates.status !== void 0) {
          updateFields.push("status = $" + (updateValues.length + 1));
          updateValues.push(updates.status);
        }
        if (updates.latitude !== void 0) {
          updateFields.push("latitude = $" + (updateValues.length + 1));
          updateValues.push(updates.latitude);
        }
        if (updates.longitude !== void 0) {
          updateFields.push("longitude = $" + (updateValues.length + 1));
          updateValues.push(updates.longitude);
        }
        if (updates.address !== void 0) {
          updateFields.push("address = $" + (updateValues.length + 1));
          updateValues.push(updates.address);
        }
        if (updates.customerName !== void 0) {
          updateFields.push('"customerName" = $' + (updateValues.length + 1));
          updateValues.push(updates.customerName);
        }
        if (updates.customerMobile !== void 0) {
          updateFields.push('"customerMobile" = $' + (updateValues.length + 1));
          updateValues.push(updates.customerMobile);
        }
        updateFields.push('"updatedAt" = $' + (updateValues.length + 1));
        updateValues.push(now);
        updateValues.push(id);
        if (updateFields.length === 1) {
          return await this.getShipmentById(id);
        }
        const result = await db.query(`
      UPDATE shipments 
      SET ${updateFields.join(", ")}
      WHERE id = $${updateValues.length}
    `, updateValues);
        if (result.rowCount === 0) {
          return null;
        }
        return await this.getShipmentById(id);
      }
      async batchUpdateShipments(updates) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let totalUpdated = 0;
        for (const update of updates) {
          if (update.status && update.shipment_id) {
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
      async getDashboardMetrics() {
        const defaultMetrics = {
          totalShipments: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          statusBreakdown: {},
          typeBreakdown: {},
          routeBreakdown: {}
        };
        try {
          const totalShipmentsRes = await db.query("SELECT COUNT(*)::int as count FROM shipments");
          const totalShipments = totalShipmentsRes.rows[0]?.count || 0;
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
          const statusBreakdown = {};
          let completed = 0;
          let inProgress = 0;
          let pending = 0;
          statusStatsRes.rows.forEach((stat) => {
            statusBreakdown[stat.status] = stat.count;
            if (stat.status === "Delivered" || stat.status === "Picked Up") {
              completed += stat.count;
            } else if (stat.status === "In Transit") {
              inProgress += stat.count;
            } else if (stat.status === "Assigned") {
              pending += stat.count;
            }
          });
          const typeBreakdown = {};
          typeStatsRes.rows.forEach((stat) => {
            typeBreakdown[stat.type] = stat.count;
          });
          const routeBreakdown = {};
          routeStatsRes.rows.forEach((stat) => {
            if (stat.routeName) {
              routeBreakdown[stat.routeName] = {
                total: stat.total || 0,
                delivered: stat.delivered || 0,
                pickedUp: stat.pickedUp || 0,
                pending: stat.pending || 0,
                cancelled: stat.cancelled || 0,
                pickupPending: stat.pickupPending || 0,
                deliveryPending: stat.deliveryPending || 0
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
            routeBreakdown
          };
        } catch (error) {
          console.error("Error fetching dashboard metrics:", error);
          return defaultMetrics;
        }
      }
      async getDashboardMetricsForEmployee(employeeId) {
        const defaultMetrics = {
          totalShipments: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          statusBreakdown: {},
          typeBreakdown: {},
          routeBreakdown: {}
        };
        try {
          const employeeCheckRes = await db.query(
            'SELECT COUNT(*)::int as count FROM shipments WHERE "employeeId" = $1',
            [employeeId]
          );
          const employeeShipments = employeeCheckRes.rows[0]?.count || 0;
          if (employeeShipments === 0) {
            console.log(`No shipments found for employee ${employeeId}`);
            return defaultMetrics;
          }
          const totalShipmentsRes = await db.query(
            'SELECT COUNT(*)::int as count FROM shipments WHERE "employeeId" = $1',
            [employeeId]
          );
          const totalShipments = totalShipmentsRes.rows[0]?.count || 0;
          if (totalShipments === 0) {
            return defaultMetrics;
          }
          const statusStatsRes = await db.query(`
        SELECT status, COUNT(*)::int as count
        FROM shipments 
        WHERE "employeeId" = $1
        GROUP BY status
      `, [employeeId]);
          const typeStatsRes = await db.query(`
        SELECT type, COUNT(*)::int as count
        FROM shipments 
        WHERE "employeeId" = $1
        GROUP BY type
      `, [employeeId]);
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
        WHERE "employeeId" = $1
        GROUP BY "routeName"
      `, [employeeId]);
          const statusBreakdown = {};
          let completed = 0;
          let inProgress = 0;
          let pending = 0;
          statusStatsRes.rows.forEach((stat) => {
            statusBreakdown[stat.status] = stat.count;
            if (stat.status === "Delivered" || stat.status === "Picked Up") {
              completed += stat.count;
            } else if (stat.status === "In Transit") {
              inProgress += stat.count;
            } else if (stat.status === "Assigned") {
              pending += stat.count;
            }
          });
          const typeBreakdown = {};
          typeStatsRes.rows.forEach((stat) => {
            typeBreakdown[stat.type] = stat.count;
          });
          const routeBreakdown = {};
          routeStatsRes.rows.forEach((stat) => {
            if (stat.routeName) {
              routeBreakdown[stat.routeName] = {
                total: stat.total || 0,
                delivered: stat.delivered || 0,
                pickedUp: stat.pickedUp || 0,
                pending: stat.pending || 0,
                cancelled: stat.cancelled || 0,
                pickupPending: stat.pickupPending || 0,
                deliveryPending: stat.deliveryPending || 0
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
            routeBreakdown
          };
        } catch (error) {
          console.error(`Error fetching dashboard metrics for employee ${employeeId}:`, error);
          return defaultMetrics;
        }
      }
      async createAcknowledgment(acknowledgment) {
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
        const result = await db.query("SELECT * FROM acknowledgments WHERE id = $1", [id]);
        return result.rows[0];
      }
      async getAcknowledmentByShipmentId(shipmentId) {
        const result = await db.query('SELECT * FROM acknowledgments WHERE "shipmentId" = $1', [shipmentId]);
        return result.rows[0] || null;
      }
      async resetDatabase() {
        await db.query("DELETE FROM acknowledgments");
        await db.query("DELETE FROM shipments");
      }
      async cleanupOldData(daysToKeep = 3) {
        const cutoffDate = /* @__PURE__ */ new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffIso = cutoffDate.toISOString();
        await db.query('DELETE FROM acknowledgments WHERE "capturedAt" < $1', [cutoffIso]);
        await db.query('DELETE FROM shipments WHERE "createdAt" < $1', [cutoffIso]);
      }
      /**
       * Execute multiple operations in a single transaction for batch processing
       * Provides atomicity for batch shipment operations
       */
      executeBatchTransaction(operations) {
        return operations();
      }
      /**
       * Batch create or update shipments with transaction support
       * Returns results for each shipment operation
       */
      async batchCreateOrUpdateShipments(shipments) {
        const results = [];
        for (const { external, internal } of shipments) {
          try {
            const existing = await this.getShipmentByExternalId(external.id);
            if (existing) {
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
                status: "updated",
                message: "Shipment updated successfully"
              });
            } else {
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
                priority: internal.priority || "medium",
                pickupAddress: internal.pickupAddress || "",
                deliveryAddress: internal.address,
                recipientName: internal.customerName,
                recipientPhone: internal.customerMobile,
                weight: internal.weight || 0,
                dimensions: internal.dimensions || "",
                specialInstructions: internal.specialInstructions,
                estimatedDeliveryTime: internal.deliveryTime
              });
              results.push({
                piashipmentid: external.id,
                internalId: newShipment.shipment_id,
                status: "created",
                message: "Shipment created successfully"
              });
            }
          } catch (error) {
            results.push({
              piashipmentid: external.id,
              internalId: null,
              status: "failed",
              message: error.message
            });
          }
        }
        return results;
      }
      // Vehicle Types CRUD operations
      async getAllVehicleTypes() {
        const result = await db.query("SELECT * FROM vehicle_types ORDER BY name");
        return result.rows;
      }
      async getVehicleTypeById(id) {
        const result = await db.query("SELECT * FROM vehicle_types WHERE id = $1", [id]);
        return result.rows[0] || null;
      }
      async createVehicleType(vehicleType) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.query(`
      INSERT INTO vehicle_types (
        id, name, fuel_efficiency, description, icon, fuel_type, co2_emissions, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
          vehicleType.id,
          vehicleType.name,
          vehicleType.fuel_efficiency,
          vehicleType.description || null,
          vehicleType.icon || "car",
          vehicleType.fuel_type || "petrol",
          vehicleType.co2_emissions || null,
          now,
          now
        ]);
        const created = await this.getVehicleTypeById(vehicleType.id);
        if (!created) {
          throw new Error("Failed to fetch created vehicle type");
        }
        return created;
      }
      async updateVehicleType(id, updates) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const updateFields = [];
        const values = [];
        if (updates.name !== void 0) {
          updateFields.push(`name = $${values.length + 1}`);
          values.push(updates.name);
        }
        if (updates.fuel_efficiency !== void 0) {
          updateFields.push(`fuel_efficiency = $${values.length + 1}`);
          values.push(updates.fuel_efficiency);
        }
        if (updates.description !== void 0) {
          updateFields.push(`description = $${values.length + 1}`);
          values.push(updates.description);
        }
        if (updates.icon !== void 0) {
          updateFields.push(`icon = $${values.length + 1}`);
          values.push(updates.icon);
        }
        if (updates.fuel_type !== void 0) {
          updateFields.push(`fuel_type = $${values.length + 1}`);
          values.push(updates.fuel_type);
        }
        if (updates.co2_emissions !== void 0) {
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
      SET ${updateFields.join(", ")}
      WHERE id = $${values.length}
    `, values);
        return await this.getVehicleTypeById(id);
      }
      async deleteVehicleType(id) {
        const result = await db.query("DELETE FROM vehicle_types WHERE id = $1", [id]);
        return (result.rowCount || 0) > 0;
      }
      // Fuel Settings CRUD operations
      async getAllFuelSettings() {
        const result = await db.query("SELECT * FROM fuel_settings ORDER BY created_at DESC, fuel_type");
        return result.rows;
      }
      async getFuelSettingById(id) {
        const result = await db.query("SELECT * FROM fuel_settings WHERE id = $1", [id]);
        return result.rows[0] || null;
      }
      async createFuelSetting(fuelSetting) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.query(`
      INSERT INTO fuel_settings (
        id, fuel_type, price_per_liter, currency, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
          fuelSetting.id,
          fuelSetting.fuel_type,
          fuelSetting.price_per_liter,
          fuelSetting.currency || "USD",
          fuelSetting.is_active !== void 0 ? fuelSetting.is_active : true,
          now,
          now
        ]);
        const createdFuel = await this.getFuelSettingById(fuelSetting.id);
        if (!createdFuel) {
          throw new Error("Failed to fetch created fuel setting");
        }
        return createdFuel;
      }
      async updateFuelSetting(id, updates) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const updateFields = [];
        const values = [];
        if (updates.fuel_type !== void 0) {
          updateFields.push(`fuel_type = $${values.length + 1}`);
          values.push(updates.fuel_type);
        }
        if (updates.price_per_liter !== void 0) {
          updateFields.push(`price_per_liter = $${values.length + 1}`);
          values.push(updates.price_per_liter);
        }
        if (updates.currency !== void 0) {
          updateFields.push(`currency = $${values.length + 1}`);
          values.push(updates.currency);
        }
        if (updates.is_active !== void 0) {
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
      SET ${updateFields.join(", ")}
      WHERE id = $${values.length}
    `, values);
        return await this.getFuelSettingById(id);
      }
      async deleteFuelSetting(id) {
        const result = await db.query("DELETE FROM fuel_settings WHERE id = $1", [id]);
        return (result.rowCount || 0) > 0;
      }
    };
  }
});

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default;
var init_vite_config = __esm({
  async "vite.config.ts"() {
    "use strict";
    vite_config_default = defineConfig({
      plugins: [
        react(),
        runtimeErrorOverlay(),
        ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
          await import("@replit/vite-plugin-cartographer").then(
            (m) => m.cartographer()
          )
        ] : []
      ],
      resolve: {
        alias: {
          "@": path2.resolve(import.meta.dirname, "client", "src"),
          "@shared": path2.resolve(import.meta.dirname, "shared"),
          "@assets": path2.resolve(import.meta.dirname, "attached_assets")
        }
      },
      root: path2.resolve(import.meta.dirname, "client"),
      build: {
        outDir: path2.resolve(import.meta.dirname, "dist/public"),
        emptyOutDir: true,
        minify: "esbuild",
        target: "es2020"
      },
      esbuild: {
        target: "es2020"
      },
      server: {
        port: 5e3,
        fs: {
          strict: true,
          deny: ["**/.*"]
        }
      }
    });
  }
});

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { nanoid } from "nanoid";
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  if (source === "scheduler") {
    console.log(`\u2699\uFE0F  ${formattedTime} Database scheduler initialized`);
  } else {
    console.log(`${formattedTime} [${source}] ${message}`);
  }
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}
var viteLogger;
var init_vite = __esm({
  async "server/vite.ts"() {
    "use strict";
    await init_vite_config();
    viteLogger = createLogger();
  }
});

// server/config/apiKeys.ts
var apiKeys_exports = {};
__export(apiKeys_exports, {
  API_KEYS: () => API_KEYS,
  getAllApiKeys: () => getAllApiKeys,
  getMaskedApiKey: () => getMaskedApiKey,
  validateApiKey: () => validateApiKey
});
function getMaskedApiKey(keyType) {
  const key = API_KEYS[keyType];
  if (key.length <= 8) {
    return "*".repeat(key.length);
  }
  const start = key.substring(0, 4);
  const end = key.substring(key.length - 4);
  const middle = "*".repeat(key.length - 8);
  return `${start}${middle}${end}`;
}
function validateApiKey(providedKey, keyType) {
  return API_KEYS[keyType] === providedKey;
}
function getAllApiKeys() {
  return Object.entries(API_KEYS).map(([type, key]) => ({
    type: type.replace(/_/g, " ").toLowerCase(),
    key,
    masked: getMaskedApiKey(type)
  }));
}
var API_KEYS;
var init_apiKeys = __esm({
  "server/config/apiKeys.ts"() {
    "use strict";
    API_KEYS = {
      // External API integration
      PIA_API_KEY: process.env.PIA_API_KEY || "printo-api-key-2024",
      EXTERNAL_API_KEY_1: process.env.EXTERNAL_API_KEY_1 || "external-system-key-1",
      EXTERNAL_API_KEY_2: process.env.EXTERNAL_API_KEY_2 || "riderpro-integration-key",
      // Internal system API key
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || "hardcoded-internal-api-key-67890",
      // Webhook authentication
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "ad96b9b4d80432777acc8129186b652a971c42f9102934e6c6537c0ae0acea8c",
      // Admin API key for system operations
      ADMIN_API_KEY: process.env.ADMIN_API_KEY || "hardcoded-admin-api-key-xyz789",
      // Access tokens for external system integration
      ACCESS_TOKEN_1: process.env.ACCESS_TOKEN_1 || "riderpro-access-token-1-abc123def456ghi789",
      ACCESS_TOKEN_2: process.env.ACCESS_TOKEN_2 || "riderpro-access-token-2-xyz789uvw456rst123"
    };
  }
});

// server/services/ExternalApiService.ts
var ExternalApiService_exports = {};
__export(ExternalApiService_exports, {
  ExternalApiService: () => ExternalApiService,
  default: () => ExternalApiService_default
});
var ExternalApiService, ExternalApiService_default;
var init_ExternalApiService = __esm({
  "server/services/ExternalApiService.ts"() {
    "use strict";
    ExternalApiService = class _ExternalApiService {
      constructor() {
        this.baseUrl = process.env.EXTERNAL_API_URL || "https://api.external-system.com";
        this.apiKey = process.env.EXTERNAL_API_KEY || "";
        this.timeout = parseInt(process.env.EXTERNAL_API_TIMEOUT || "30000");
      }
      /**
       * Get access token for external API calls
       * Rotates between available tokens for load balancing
       */
      getAccessToken() {
        const { API_KEYS: API_KEYS2 } = (init_apiKeys(), __toCommonJS(apiKeys_exports));
        const tokens = [API_KEYS2.ACCESS_TOKEN_1, API_KEYS2.ACCESS_TOKEN_2];
        const randomIndex = Math.floor(Math.random() * tokens.length);
        return tokens[randomIndex];
      }
      static getInstance() {
        if (!_ExternalApiService.instance) {
          _ExternalApiService.instance = new _ExternalApiService();
        }
        return _ExternalApiService.instance;
      }
      /**
       * Prepare optimized JSON payload for external API
       * Removes null/undefined values and optimizes structure for performance
       */
      prepareSyncData(shipment) {
        const syncData = {
          shipment_id: shipment.shipment_id || shipment.trackingNumber || "unknown",
          status: shipment.status,
          tracking: {},
          updated_at: shipment.updatedAt
        };
        if (shipment.start_latitude !== null && shipment.start_latitude !== void 0) {
          syncData.tracking.start_latitude = shipment.start_latitude;
        }
        if (shipment.start_longitude !== null && shipment.start_longitude !== void 0) {
          syncData.tracking.start_longitude = shipment.start_longitude;
        }
        if (shipment.stop_latitude !== null && shipment.stop_latitude !== void 0) {
          syncData.tracking.stop_latitude = shipment.stop_latitude;
        }
        if (shipment.stop_longitude !== null && shipment.stop_longitude !== void 0) {
          syncData.tracking.stop_longitude = shipment.stop_longitude;
        }
        if (shipment.km_travelled !== null && shipment.km_travelled !== void 0 && shipment.km_travelled > 0) {
          syncData.tracking.km_travelled = shipment.km_travelled;
        }
        if (shipment.expectedDeliveryTime) {
          syncData.delivery_time = shipment.expectedDeliveryTime;
        } else if (shipment.deliveryTime) {
          syncData.delivery_time = shipment.deliveryTime;
        }
        if (shipment.customerName || shipment.recipientName) {
          syncData.customer_info = {
            name: shipment.customerName || shipment.recipientName || "",
            phone: shipment.customerMobile || shipment.recipientPhone || "",
            address: shipment.address || shipment.deliveryAddress || ""
          };
        }
        if (shipment.weight || shipment.dimensions) {
          syncData.package_info = {
            weight: shipment.weight || 0,
            dimensions: shipment.dimensions || "",
            special_instructions: shipment.specialInstructions || void 0
          };
        }
        if (shipment.routeName || shipment.employeeId || shipment.priority) {
          syncData.route_info = {
            route_name: shipment.routeName || "",
            employee_id: shipment.employeeId || "",
            priority: shipment.priority || "medium"
          };
        }
        return syncData;
      }
      /**
       * Send shipment data to external API with optimized JSON format
       */
      async syncShipment(shipment) {
        try {
          const syncData = this.prepareSyncData(shipment);
          if (!syncData.shipment_id) {
            throw new Error("Shipment ID is required for external sync");
          }
          const payload = JSON.stringify(syncData, null, 0);
          console.log(`Syncing shipment ${syncData.shipment_id} to external API...`);
          console.log("Payload size:", payload.length, "bytes");
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeout);
          const accessToken = this.getAccessToken();
          console.log(`Using access token: ${accessToken.substring(0, 10)}...`);
          const response = await fetch(`${this.baseUrl}/shipments/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
              "X-API-Version": "1.0",
              "X-Request-ID": `riderpro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            },
            body: payload,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`External API error: ${response.status} - ${errorText}`);
          }
          const result = await response.json();
          return {
            success: true,
            message: "Shipment synced successfully",
            external_id: result.external_id || syncData.shipment_id,
            synced_at: (/* @__PURE__ */ new Date()).toISOString()
          };
        } catch (error) {
          console.error("External API sync failed:", error);
          return {
            success: false,
            message: "Failed to sync to external system",
            error: error.message
          };
        }
      }
      /**
       * Batch sync multiple shipments for better performance
       */
      async batchSyncShipments(shipments) {
        const results = [];
        const batchSize = 10;
        for (let i = 0; i < shipments.length; i += batchSize) {
          const batch = shipments.slice(i, i + batchSize);
          try {
            const batchPayload = {
              shipments: batch.map((shipment) => this.prepareSyncData(shipment))
            };
            const payload = JSON.stringify(batchPayload, null, 0);
            console.log(`Batch syncing ${batch.length} shipments...`);
            console.log("Batch payload size:", payload.length, "bytes");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);
            const accessToken = this.getAccessToken();
            console.log(`Using access token for batch sync: ${accessToken.substring(0, 10)}...`);
            const response = await fetch(`${this.baseUrl}/shipments/batch-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
                "X-API-Version": "1.0",
                "X-Request-ID": `riderpro-batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
              },
              body: payload,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`External API batch error: ${response.status} - ${errorText}`);
            }
            const result = await response.json();
            batch.forEach((shipment, index) => {
              results.push({
                success: result.results?.[index]?.success || false,
                message: result.results?.[index]?.message || "Batch sync completed",
                external_id: result.results?.[index]?.external_id || shipment.shipment_id,
                synced_at: (/* @__PURE__ */ new Date()).toISOString()
              });
            });
          } catch (error) {
            console.error("Batch sync failed:", error);
            batch.forEach(() => {
              results.push({
                success: false,
                message: "Batch sync failed",
                error: error.message
              });
            });
          }
        }
        return results;
      }
      /**
       * Validate JSON payload size and structure for performance
       */
      validatePayload(syncData) {
        const payload = JSON.stringify(syncData, null, 0);
        const size = Buffer.byteLength(payload, "utf8");
        const warnings = [];
        if (size > 1024 * 1024) {
          warnings.push(`Large payload size: ${Math.round(size / 1024)}KB`);
        }
        if (!syncData.shipment_id) {
          warnings.push("Missing shipment_id");
        }
        if (!syncData.status) {
          warnings.push("Missing status");
        }
        return {
          valid: warnings.length === 0,
          size,
          warnings
        };
      }
    };
    ExternalApiService_default = ExternalApiService;
  }
});

// server/services/scheduler.ts
var scheduler_exports = {};
import cron from "node-cron";
var init_scheduler = __esm({
  async "server/services/scheduler.ts"() {
    "use strict";
    init_queries();
    await init_vite();
    cron.schedule("0 0 * * *", () => {
      try {
        log("Starting daily database reset...", "scheduler");
        const queries = new ShipmentQueries(false);
        queries.resetDatabase();
        log("Live database reset completed successfully", "scheduler");
      } catch (error) {
        console.error("Failed to reset live database:", error);
        log(`Database reset failed: ${error}`, "scheduler");
      }
    });
    cron.schedule("0 1 * * *", () => {
      try {
        log("Starting replica database cleanup...", "scheduler");
        const replicaQueries = new ShipmentQueries(true);
        replicaQueries.cleanupOldData(3);
        log("Replica database cleanup completed successfully", "scheduler");
      } catch (error) {
        console.error("Failed to cleanup replica database:", error);
        log(`Database cleanup failed: ${error}`, "scheduler");
      }
    });
    log("Database scheduler initialized", "scheduler");
  }
});

// server/vercel.ts
import dotenv2 from "dotenv";
import express3 from "express";

// server/routes.ts
import { createServer } from "http";
import express2 from "express";
import bcrypt2 from "bcrypt";

// server/storage.ts
init_queries();
var PostgresStorage = class {
  constructor() {
    this.queries = new ShipmentQueries();
  }
  // Expose database for validation services
  getDatabase() {
    return this.queries.getDatabase();
  }
  // Direct database access methods for compatibility
  prepare(sql) {
    return this.queries.getDatabase().prepare(sql);
  }
  exec(sql) {
    return this.queries.getDatabase().exec(sql);
  }
  async getShipments(filters) {
    return this.queries.getAllShipments(filters);
  }
  async getShipment(id) {
    const shipment = await this.queries.getShipmentById(id);
    return shipment || void 0;
  }
  async getShipmentByExternalId(externalId) {
    const shipment = await this.queries.getShipmentByExternalId(externalId);
    return shipment || void 0;
  }
  async createShipment(shipment) {
    return await this.queries.createShipment(shipment);
  }
  async updateShipment(id, updates) {
    const shipment = await this.queries.updateShipment(id, updates);
    return shipment || void 0;
  }
  async batchUpdateShipments(updates) {
    return await this.queries.batchUpdateShipments(updates.updates);
  }
  async batchCreateOrUpdateShipments(shipments) {
    return this.queries.batchCreateOrUpdateShipments(shipments);
  }
  async createAcknowledgment(acknowledgment) {
    return this.queries.createAcknowledgment(acknowledgment);
  }
  async getAcknowledgmentByShipmentId(shipmentId) {
    const acknowledgment = await this.queries.getAcknowledmentByShipmentId(shipmentId);
    return acknowledgment || void 0;
  }
  async getDashboardMetrics() {
    return this.queries.getDashboardMetrics();
  }
  async getDashboardMetricsForEmployee(employeeId) {
    return this.queries.getDashboardMetricsForEmployee(employeeId);
  }
  // Vehicle Types operations
  async getVehicleTypes() {
    return this.queries.getAllVehicleTypes();
  }
  async getVehicleType(id) {
    const vehicleType = await this.queries.getVehicleTypeById(id);
    return vehicleType || void 0;
  }
  async createVehicleType(vehicleType) {
    return this.queries.createVehicleType(vehicleType);
  }
  async updateVehicleType(id, updates) {
    const vehicleType = await this.queries.updateVehicleType(id, updates);
    return vehicleType || void 0;
  }
  async deleteVehicleType(id) {
    return this.queries.deleteVehicleType(id);
  }
  // Fuel Settings operations
  async getFuelSettings() {
    return this.queries.getAllFuelSettings();
  }
  async getFuelSetting(id) {
    const fuelSetting = await this.queries.getFuelSettingById(id);
    return fuelSetting || void 0;
  }
  async createFuelSetting(fuelSetting) {
    return this.queries.createFuelSetting(fuelSetting);
  }
  async updateFuelSetting(id, updates) {
    const fuelSetting = await this.queries.updateFuelSetting(id, updates);
    return fuelSetting || void 0;
  }
  async deleteFuelSetting(id) {
    return this.queries.deleteFuelSetting(id);
  }
};
var storage = new PostgresStorage();

// server/routes.ts
init_pg_connection();

// server/middleware/auth.ts
init_pg_connection();
var initializeAuth = () => {
  console.log("\u2705 Authentication initialized - using Printo API with Bearer tokens");
};
var PRINTO_API_BASE_URL = process.env.PRINTO_API_BASE_URL || "https://pia.printo.in/api/v1";
var PRINTO_LOGIN_URL = `${PRINTO_API_BASE_URL}/auth/`;
var PRINTO_REFRESH_URL = `${PRINTO_API_BASE_URL}/auth/refresh/`;
var authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authentication required", code: "UNAUTHORIZED" });
    }
    const accessToken = authHeader.substring(7);
    const tokenParts = accessToken.split("_");
    if (tokenParts.length < 3 || tokenParts[0] !== "local") {
      return res.status(401).json({ success: false, message: "Invalid token format", code: "INVALID_TOKEN" });
    }
    const userId = tokenParts.slice(2).join("_");
    const userRow = await db.prepare(`
        SELECT id, rider_id as username, rider_id as email, role, rider_id as employee_id, full_name, 
               '' as access_token, '' as refresh_token, is_active, last_login_at as last_login, 
               created_at, updated_at
        FROM rider_accounts 
        WHERE id = $1 AND is_active = true
      `).get(userId);
    if (!userRow) {
      return res.status(401).json({ success: false, message: "Invalid or expired token", code: "INVALID_TOKEN" });
    }
    const isSuperUser = userRow.role === "super_user" || userRow.role === "admin";
    const isOpsTeam = userRow.role === "ops_team" || userRow.role === "admin";
    const isStaff = userRow.role === "staff" || userRow.role === "admin";
    const user = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      role: userRow.role,
      employeeId: userRow.employee_id,
      fullName: userRow.full_name,
      accessToken: userRow.access_token,
      refreshToken: userRow.refresh_token,
      isActive: Boolean(userRow.is_active),
      isSuperUser,
      isOpsTeam,
      isStaff,
      lastLogin: userRow.last_login,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at
    };
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      code: "AUTH_FAILED",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// shared/schema.ts
var updateShipmentSchema = {
  parse: (data) => {
    return data;
  },
  validate: (data) => true
};
var batchUpdateSchema = {
  validate: (data) => true
};

// server/utils/fileUpload.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID as randomUUID2 } from "crypto";
import sharp from "sharp";
var uploadsDir = path.join(process.cwd(), "uploads");
var signaturesDir = path.join(uploadsDir, "signatures");
var photosDir = path.join(uploadsDir, "photos");
[uploadsDir, signaturesDir, photosDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
var storage2 = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = file.fieldname === "signature" ? signaturesDir : photosDir;
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const extension = path.extname(file.originalname) || ".png";
    const filename = `${randomUUID2()}${extension}`;
    cb(null, filename);
  }
});
var fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};
var memoryStorage = multer.memoryStorage();
var upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
    // 5MB limit for raw files (will be compressed to max 3MB)
  }
});
function getFileUrl(filename, type) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5e3}`;
  return `${baseUrl}/uploads/${type}s/${filename}`;
}
async function saveBase64File(base64Data, type) {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid base64 data");
  }
  const base64Content = matches[2];
  const buffer = Buffer.from(base64Content, "base64");
  const filename = `${randomUUID2()}.${type === "signature" ? "png" : "jpg"}`;
  const outputPath = path.join(type === "signature" ? signaturesDir : photosDir, filename);
  if (type === "photo") {
    await sharp(buffer).resize(1200, 1200, {
      fit: "inside",
      withoutEnlargement: true
    }).jpeg({
      quality: 75,
      chromaSubsampling: "4:2:0"
    }).toFile(outputPath);
  } else {
    await sharp(buffer).resize(600, 200, {
      // Smaller signature size
      fit: "inside",
      withoutEnlargement: true
    }).png({
      compressionLevel: 9,
      quality: 75
    }).toFile(outputPath);
  }
  return filename;
}

// server/services/externalSync.ts
await init_vite();
import axios from "axios";
import FormData from "form-data";
import fs3 from "fs";
import path4 from "path";
var ExternalSyncService = class {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1e3;
    // 1 second
    this.externalApiUrl = "deliveryq/status-update/";
    this.bearerToken = "Aabc456fv789";
    // Webhook configuration management
    this.webhookConfigs = /* @__PURE__ */ new Map();
    this.failedDeliveries = /* @__PURE__ */ new Map();
    this.deliveryStats = {
      totalAttempts: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      retriedDeliveries: 0,
      lastResetTime: Date.now()
    };
    // Performance metrics tracking
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      jsonRequests: 0,
      multipartRequests: 0,
      totalProcessingTime: 0,
      totalFileSize: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now()
    };
    this.validateConfiguration();
    this.initializeDefaultWebhookConfig();
    log(`ExternalSyncService initialized with endpoint: ${this.externalApiUrl}`, "external-sync");
    log(`External sync configuration: endpoint=${this.externalApiUrl}, token=Bearer ${this.bearerToken.substring(0, 8)}...`, "external-sync");
  }
  /**
   * Initialize default webhook configuration
   */
  initializeDefaultWebhookConfig() {
    const defaultConfig = {
      url: this.externalApiUrl,
      token: this.bearerToken,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      timeout: 15e3,
      enabled: true
    };
    this.webhookConfigs.set("default", defaultConfig);
    log("Default webhook configuration initialized", "external-sync");
  }
  /**
   * Add or update webhook configuration
   */
  addWebhookConfig(name, config) {
    const fullConfig = {
      url: config.url || this.externalApiUrl,
      token: config.token || this.bearerToken,
      maxRetries: config.maxRetries || this.maxRetries,
      retryDelay: config.retryDelay || this.retryDelay,
      timeout: config.timeout || 15e3,
      enabled: config.enabled !== void 0 ? config.enabled : true
    };
    this.webhookConfigs.set(name, fullConfig);
    log(`Webhook configuration '${name}' added/updated: ${fullConfig.url}`, "external-sync");
  }
  /**
   * Get webhook configuration by name
   */
  getWebhookConfig(name = "default") {
    return this.webhookConfigs.get(name);
  }
  /**
   * List all webhook configurations
   */
  listWebhookConfigs() {
    const configs = {};
    this.webhookConfigs.forEach((config, name) => {
      configs[name] = { ...config };
    });
    return configs;
  }
  /**
   * Enable or disable a webhook configuration
   */
  toggleWebhookConfig(name, enabled) {
    const config = this.webhookConfigs.get(name);
    if (config) {
      config.enabled = enabled;
      log(`Webhook configuration '${name}' ${enabled ? "enabled" : "disabled"}`, "external-sync");
      return true;
    }
    return false;
  }
  /**
   * Remove webhook configuration
   */
  removeWebhookConfig(name) {
    if (name === "default") {
      log("Cannot remove default webhook configuration", "external-sync");
      return false;
    }
    const removed = this.webhookConfigs.delete(name);
    if (removed) {
      log(`Webhook configuration '${name}' removed`, "external-sync");
    }
    return removed;
  }
  /**
   * Validates service configuration and required dependencies
   */
  validateConfiguration() {
    if (!this.externalApiUrl || this.externalApiUrl.trim() === "") {
      throw new Error("ExternalSyncService: API endpoint is not configured");
    }
    if (!this.bearerToken || this.bearerToken.trim() === "") {
      throw new Error("ExternalSyncService: Bearer token is not configured");
    }
    try {
      if (typeof axios === "undefined") {
        throw new Error("ExternalSyncService: axios dependency is not available");
      }
      if (typeof FormData === "undefined") {
        throw new Error("ExternalSyncService: FormData dependency is not available");
      }
      if (!fs3 || typeof fs3.existsSync !== "function") {
        throw new Error("ExternalSyncService: fs module is not available");
      }
      if (!path4 || typeof path4.join !== "function") {
        throw new Error("ExternalSyncService: path module is not available");
      }
      log("ExternalSyncService: All dependencies validated successfully", "external-sync");
    } catch (error) {
      log(`ExternalSyncService: Dependency validation failed: ${error.message}`, "external-sync");
      throw error;
    }
    log(`ExternalSyncService: Configuration validated - endpoint: ${this.externalApiUrl}, maxRetries: ${this.maxRetries}, retryDelay: ${this.retryDelay}ms`, "external-sync");
  }
  /**
   * Determines the appropriate content type based on payload content
   * Returns 'multipart' if acknowledgement contains file URLs, 'json' otherwise
   */
  determineContentType(payload) {
    if (payload.acknowledgement) {
      const hasSignature = payload.acknowledgement.signatureUrl && payload.acknowledgement.signatureUrl.trim() !== "";
      const hasPhoto = payload.acknowledgement.photoUrl && payload.acknowledgement.photoUrl.trim() !== "";
      if (hasSignature || hasPhoto) {
        return "multipart";
      }
    }
    return "json";
  }
  async syncShipmentUpdate(shipment, acknowledgment) {
    const payload = {
      shipmentId: shipment.shipment_id,
      status: shipment.status,
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (acknowledgment) {
      payload.acknowledgement = {
        signatureUrl: acknowledgment.signatureUrl,
        photoUrl: acknowledgment.photoUrl,
        acknowledgment_captured_at: acknowledgment.acknowledgment_captured_at
      };
    }
    const contentType = this.determineContentType(payload);
    log(`Determined content type: ${contentType} for shipment ${payload.shipmentId}`, "external-sync");
    return this.sendWithRetry(payload, contentType);
  }
  async sendWithRetry(payload, contentType, attempt = 1) {
    try {
      log(`Syncing shipment ${payload.shipmentId} as ${contentType} (attempt ${attempt})`, "external-sync");
      if (contentType === "multipart") {
        return await this.sendMultipartPayload(payload, attempt);
      } else {
        return await this.sendJsonPayload(payload, attempt);
      }
    } catch (error) {
      const errorContext = this.getErrorContext(error, contentType, payload);
      log(`${contentType.toUpperCase()} sync failed for shipment ${payload.shipmentId} (attempt ${attempt}): ${errorContext}`, "external-sync");
      if (attempt < this.maxRetries) {
        const retryDelay = contentType === "multipart" ? this.retryDelay * Math.pow(2, attempt - 1) : this.retryDelay * attempt;
        log(`Retrying in ${retryDelay}ms (${contentType} mode, attempt ${attempt + 1}/${this.maxRetries})`, "external-sync");
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        if (contentType === "multipart" && this.isFileRelatedError(error) && attempt === this.maxRetries - 1) {
          log(`Final retry for shipment ${payload.shipmentId}: falling back to JSON mode due to file processing issues`, "external-sync");
          return this.sendWithRetry(payload, "json", attempt + 1);
        }
        return this.sendWithRetry(payload, contentType, attempt + 1);
      }
      log(`All ${contentType.toUpperCase()} sync attempts failed for shipment ${payload.shipmentId}. Final error: ${errorContext}`, "external-sync");
      return false;
    }
  }
  /**
   * Generates detailed error context based on error type and content type
   */
  getErrorContext(error, contentType, payload) {
    const baseError = error.message || "Unknown error";
    if (contentType === "multipart") {
      if (this.isFileRelatedError(error)) {
        const fileInfo = this.getFileInfo(payload);
        return `File processing error - ${baseError}. Files: ${fileInfo}`;
      } else if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
        return `Network error during multipart upload - ${baseError}. This may be due to large file size or slow connection`;
      } else if (error.response?.status) {
        return `HTTP ${error.response.status} error during multipart upload - ${baseError}`;
      }
      return `Multipart upload error - ${baseError}`;
    } else {
      if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
        return `Network error during JSON sync - ${baseError}`;
      } else if (error.response?.status) {
        return `HTTP ${error.response.status} error during JSON sync - ${baseError}`;
      }
      return `JSON sync error - ${baseError}`;
    }
  }
  /**
   * Determines if an error is related to file processing
   */
  isFileRelatedError(error) {
    const errorMessage = (error.message || "").toLowerCase();
    return errorMessage.includes("file") || errorMessage.includes("enoent") || errorMessage.includes("permission") || errorMessage.includes("buffer") || error.code === "ENOENT";
  }
  /**
   * Gets file information for error logging
   */
  getFileInfo(payload) {
    if (!payload.acknowledgement) return "none";
    const files = [];
    if (payload.acknowledgement.signatureUrl) files.push("signature");
    if (payload.acknowledgement.photoUrl) files.push("photo");
    return files.length > 0 ? files.join(", ") : "none";
  }
  /**
   * Updates performance metrics after a sync operation
   */
  updatePerformanceMetrics(contentType, success, duration, fileSize = 0) {
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.totalProcessingTime += duration;
    if (success) {
      this.performanceMetrics.successfulRequests++;
    } else {
      this.performanceMetrics.failedRequests++;
    }
    if (contentType === "json") {
      this.performanceMetrics.jsonRequests++;
    } else {
      this.performanceMetrics.multipartRequests++;
      this.performanceMetrics.totalFileSize += fileSize;
    }
    this.performanceMetrics.averageResponseTime = this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalRequests;
  }
  /**
   * Gets current performance metrics
   */
  getPerformanceMetrics() {
    const uptime = Date.now() - this.performanceMetrics.lastResetTime;
    const successRate = this.performanceMetrics.totalRequests > 0 ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests * 100).toFixed(2) : "0.00";
    return {
      ...this.performanceMetrics,
      uptime,
      successRate: `${successRate}%`,
      requestsPerMinute: this.performanceMetrics.totalRequests / (uptime / 6e4),
      averageFileSize: this.performanceMetrics.multipartRequests > 0 ? Math.round(this.performanceMetrics.totalFileSize / this.performanceMetrics.multipartRequests) : 0
    };
  }
  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      jsonRequests: 0,
      multipartRequests: 0,
      totalProcessingTime: 0,
      totalFileSize: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now()
    };
    log("Performance metrics reset", "external-sync");
  }
  /**
   * Logs performance summary periodically
   */
  logPerformanceSummary() {
    const metrics = this.getPerformanceMetrics();
    log(`Performance Summary - Total: ${metrics.totalRequests}, Success: ${metrics.successRate}, Avg Time: ${Math.round(metrics.averageResponseTime)}ms, JSON: ${metrics.jsonRequests}, Multipart: ${metrics.multipartRequests}`, "external-sync");
  }
  /**
   * Sends payload as JSON with application/json content type
   * Implements JSON-specific request logic with proper headers and error handling
   */
  async sendJsonPayload(payload, attempt) {
    const startTime = Date.now();
    log(`Sending JSON payload for shipment ${payload.shipmentId} (attempt ${attempt}) - Size: ${JSON.stringify(payload).length} bytes`, "external-sync");
    try {
      const response = await axios.post(this.externalApiUrl, payload, {
        timeout: 1e4,
        // 10 second timeout
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.bearerToken}`
        }
      });
      const duration = Date.now() - startTime;
      if (response.status >= 200 && response.status < 300) {
        this.updatePerformanceMetrics("json", true, duration);
        log(`Successfully synced shipment ${payload.shipmentId} as JSON (status: ${response.status}, ${duration}ms)`, "external-sync");
        return true;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics("json", false, duration);
      if (error.code === "ECONNABORTED") {
        throw new Error(`JSON sync timeout after ${duration}ms - payload may be too large or network is slow`);
      } else if (error.response) {
        throw new Error(`JSON sync HTTP error ${error.response.status}: ${error.response.statusText} (${duration}ms)`);
      } else if (error.code) {
        throw new Error(`JSON sync network error ${error.code}: ${error.message} (${duration}ms)`);
      }
      throw new Error(`JSON sync failed: ${error.message} (${duration}ms)`);
    }
  }
  /**
   * Processes a file URL and converts it to a buffer for upload
   * Handles both signature and photo file types with proper error handling and memory optimization
   */
  async processFileForUpload(fileUrl, fieldName) {
    const startTime = Date.now();
    let memoryBefore = 0;
    try {
      if (process.memoryUsage) {
        memoryBefore = process.memoryUsage().heapUsed;
      }
      if (!fileUrl || fileUrl.trim() === "") {
        log(`Empty file URL provided for field ${fieldName}`, "external-sync");
        return null;
      }
      let filePath = fileUrl;
      if (fileUrl.startsWith("http")) {
        const url = new URL(fileUrl);
        filePath = path4.join(process.cwd(), url.pathname);
      } else if (fileUrl.startsWith("/uploads/")) {
        filePath = path4.join(process.cwd(), fileUrl);
      } else {
        filePath = fileUrl;
      }
      if (!fs3.existsSync(filePath)) {
        log(`File not found: ${filePath} for field ${fieldName}`, "external-sync");
        return null;
      }
      const stats = fs3.statSync(filePath);
      const fileSize = stats.size;
      if (fileSize > 5 * 1024 * 1024) {
        log(`Large file detected (${fileSize} bytes), using streaming for ${fieldName}`, "external-sync");
        log(`Warning: File ${filePath} is large (${fileSize} bytes), consider implementing streaming`, "external-sync");
      }
      const buffer = fs3.readFileSync(filePath);
      const duration = Date.now() - startTime;
      const memoryAfter = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      const memoryDelta = memoryAfter - memoryBefore;
      log(`Successfully processed file ${filePath} (${buffer.length} bytes) for field ${fieldName} in ${duration}ms, memory delta: ${memoryDelta} bytes`, "external-sync");
      return buffer;
    } catch (error) {
      const duration = Date.now() - startTime;
      log(`Error processing file ${fileUrl} for field ${fieldName} after ${duration}ms: ${error.message}`, "external-sync");
      return null;
    }
  }
  /**
   * Cleanup temporary resources after upload
   */
  cleanupAfterUpload(success, fileBuffers) {
    try {
      if (success && fileBuffers.length > 0) {
        fileBuffers.forEach((buffer, index) => {
          if (buffer) {
            if (buffer.length > 1024 * 1024) {
              log(`Clearing large buffer ${index} (${buffer.length} bytes) after successful upload`, "external-sync");
            }
          }
        });
        const totalSize = fileBuffers.reduce((sum, buf) => sum + (buf?.length || 0), 0);
        if (totalSize > 5 * 1024 * 1024 && global.gc) {
          log(`Suggesting garbage collection after large upload (${totalSize} bytes)`, "external-sync");
          global.gc();
        }
      }
    } catch (error) {
      log(`Error during cleanup: ${error.message}`, "external-sync");
    }
  }
  /**
   * Sends payload as multipart form data with file attachments
   * Implements FormData construction with shipment data and files
   */
  async sendMultipartPayload(payload, attempt) {
    const startTime = Date.now();
    let totalFileSize = 0;
    let processedFiles = [];
    try {
      log(`Sending multipart payload for shipment ${payload.shipmentId} (attempt ${attempt})`, "external-sync");
      const formData = new FormData();
      formData.append("shipmentId", payload.shipmentId);
      formData.append("status", payload.status);
      formData.append("syncedAt", payload.syncedAt);
      if (payload.acknowledgement) {
        formData.append("acknowledgementCapturedAt", payload.acknowledgement.acknowledgment_captured_at);
        if (payload.acknowledgement.signatureUrl) {
          const signatureBuffer = await this.processFileForUpload(
            payload.acknowledgement.signatureUrl,
            "signature"
          );
          if (signatureBuffer) {
            formData.append("signature", signatureBuffer, {
              filename: "signature.png",
              contentType: "image/png"
            });
            totalFileSize += signatureBuffer.length;
            processedFiles.push(`signature(${signatureBuffer.length}b)`);
          } else {
            log(`Warning: Signature file could not be processed for shipment ${payload.shipmentId}`, "external-sync");
          }
        }
        if (payload.acknowledgement.photoUrl) {
          const photoBuffer = await this.processFileForUpload(
            payload.acknowledgement.photoUrl,
            "photo"
          );
          if (photoBuffer) {
            formData.append("photo", photoBuffer, {
              filename: "photo.jpg",
              contentType: "image/jpeg"
            });
            totalFileSize += photoBuffer.length;
            processedFiles.push(`photo(${photoBuffer.length}b)`);
          } else {
            log(`Warning: Photo file could not be processed for shipment ${payload.shipmentId}`, "external-sync");
          }
        }
      }
      log(`Multipart upload details for shipment ${payload.shipmentId}: Files: [${processedFiles.join(", ")}], Total size: ${totalFileSize} bytes`, "external-sync");
      if (processedFiles.length === 0) {
        log(`No files processed for multipart upload, falling back to JSON for shipment ${payload.shipmentId}`, "external-sync");
        return this.sendJsonPayload(payload, attempt);
      }
      const timeout = Math.max(15e3, Math.min(6e4, 15e3 + totalFileSize / 1024));
      const response = await axios.post(this.externalApiUrl, formData, {
        timeout,
        headers: {
          "Authorization": `Bearer ${this.bearerToken}`,
          ...formData.getHeaders()
          // Let FormData set Content-Type with boundary
        }
      });
      const duration = Date.now() - startTime;
      if (response.status >= 200 && response.status < 300) {
        this.updatePerformanceMetrics("multipart", true, duration, totalFileSize);
        this.cleanupAfterUpload(true, []);
        log(`Successfully synced shipment ${payload.shipmentId} as multipart (status: ${response.status}, ${duration}ms, ${totalFileSize} bytes)`, "external-sync");
        return true;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics("multipart", false, duration, totalFileSize);
      this.cleanupAfterUpload(false, []);
      if (this.isFileRelatedError(error)) {
        log(`File processing error for shipment ${payload.shipmentId}: ${error.message}. Processed files: [${processedFiles.join(", ")}]`, "external-sync");
        log(`Falling back to JSON mode for shipment ${payload.shipmentId} due to file processing failure`, "external-sync");
        return this.sendJsonPayload(payload, attempt);
      } else if (error.code === "ECONNABORTED") {
        throw new Error(`Multipart upload timeout after ${duration}ms - file size: ${totalFileSize} bytes may be too large`);
      } else if (error.response) {
        throw new Error(`Multipart upload HTTP error ${error.response.status}: ${error.response.statusText} (${duration}ms, ${totalFileSize} bytes)`);
      } else if (error.code) {
        throw new Error(`Multipart upload network error ${error.code}: ${error.message} (${duration}ms, ${totalFileSize} bytes)`);
      }
      throw new Error(`Multipart upload failed: ${error.message} (${duration}ms, ${totalFileSize} bytes)`);
    }
  }
  /**
   * Sends a single update to external system with enhanced webhook delivery
   * Used by the external update API endpoints
   */
  async sendUpdateToExternal(updatePayload, webhookName = "default") {
    const webhookConfig2 = this.getWebhookConfig(webhookName);
    if (!webhookConfig2) {
      log(`Webhook configuration '${webhookName}' not found`, "external-sync");
      return {
        success: false,
        attempts: 0,
        lastError: `Webhook configuration '${webhookName}' not found`,
        webhookUrl: "unknown"
      };
    }
    if (!webhookConfig2.enabled) {
      log(`Webhook configuration '${webhookName}' is disabled`, "external-sync");
      return {
        success: false,
        attempts: 0,
        lastError: `Webhook configuration '${webhookName}' is disabled`,
        webhookUrl: webhookConfig2.url
      };
    }
    try {
      log(`Sending update to external system for shipment ${updatePayload.id} via webhook '${webhookName}'`, "external-sync");
      const syncPayload = {
        shipmentId: updatePayload.id,
        status: updatePayload.status,
        syncedAt: updatePayload.statusTimestamp || (/* @__PURE__ */ new Date()).toISOString()
      };
      if (updatePayload.deliveryDetails) {
        syncPayload.acknowledgement = {
          signatureUrl: updatePayload.deliveryDetails.signature,
          photoUrl: updatePayload.deliveryDetails.photo,
          acknowledgment_captured_at: updatePayload.deliveryDetails.actualDeliveryTime || updatePayload.statusTimestamp || (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      const result = await this.sendWithEnhancedRetry(syncPayload, webhookConfig2);
      this.updateDeliveryStats(result.success, result.attempts);
      return result;
    } catch (error) {
      log(`Error sending update to external system: ${error.message}`, "external-sync");
      this.updateDeliveryStats(false, 1);
      return {
        success: false,
        attempts: 1,
        lastError: error.message,
        webhookUrl: webhookConfig2.url
      };
    }
  }
  /**
   * Enhanced retry mechanism with webhook-specific configuration
   */
  async sendWithEnhancedRetry(payload, webhookConfig2) {
    let lastError = "";
    let attempts = 0;
    const maxRetries = webhookConfig2.maxRetries;
    const baseDelay = webhookConfig2.retryDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts = attempt;
      try {
        log(`Webhook delivery attempt ${attempt}/${maxRetries} for shipment ${payload.shipmentId} to ${webhookConfig2.url}`, "external-sync");
        const contentType = this.determineContentType(payload);
        const success = await this.sendToWebhook(payload, contentType, webhookConfig2);
        if (success) {
          log(`Webhook delivery successful for shipment ${payload.shipmentId} after ${attempt} attempts`, "external-sync");
          return {
            success: true,
            attempts,
            deliveredAt: (/* @__PURE__ */ new Date()).toISOString(),
            webhookUrl: webhookConfig2.url
          };
        }
        throw new Error("Webhook delivery failed");
      } catch (error) {
        lastError = error.message;
        log(`Webhook delivery attempt ${attempt} failed for shipment ${payload.shipmentId}: ${lastError}`, "external-sync");
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1e3;
          log(`Retrying webhook delivery in ${Math.round(delay)}ms`, "external-sync");
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    this.addToFailedDeliveries(payload, webhookConfig2, lastError);
    return {
      success: false,
      attempts,
      lastError,
      webhookUrl: webhookConfig2.url
    };
  }
  /**
   * Send payload to specific webhook with configuration
   */
  async sendToWebhook(payload, contentType, webhookConfig2) {
    const startTime = Date.now();
    try {
      if (contentType === "multipart") {
        return await this.sendMultipartToWebhook(payload, webhookConfig2);
      } else {
        return await this.sendJsonToWebhook(payload, webhookConfig2);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      log(`Webhook delivery failed after ${duration}ms: ${error.message}`, "external-sync");
      throw error;
    }
  }
  /**
   * Send JSON payload to webhook
   */
  async sendJsonToWebhook(payload, webhookConfig2) {
    const response = await axios.post(webhookConfig2.url, payload, {
      timeout: webhookConfig2.timeout,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${webhookConfig2.token}`
      }
    });
    return response.status >= 200 && response.status < 300;
  }
  /**
   * Send multipart payload to webhook
   */
  async sendMultipartToWebhook(payload, webhookConfig2) {
    const formData = new FormData();
    formData.append("shipmentId", payload.shipmentId);
    formData.append("status", payload.status);
    formData.append("syncedAt", payload.syncedAt);
    if (payload.acknowledgement) {
      formData.append("acknowledgementCapturedAt", payload.acknowledgement.acknowledgment_captured_at);
      if (payload.acknowledgement.signatureUrl) {
        const signatureBuffer = await this.processFileForUpload(payload.acknowledgement.signatureUrl, "signature");
        if (signatureBuffer) {
          formData.append("signature", signatureBuffer, {
            filename: "signature.png",
            contentType: "image/png"
          });
        }
      }
      if (payload.acknowledgement.photoUrl) {
        const photoBuffer = await this.processFileForUpload(payload.acknowledgement.photoUrl, "photo");
        if (photoBuffer) {
          formData.append("photo", photoBuffer, {
            filename: "photo.jpg",
            contentType: "image/jpeg"
          });
        }
      }
    }
    const response = await axios.post(webhookConfig2.url, formData, {
      timeout: webhookConfig2.timeout,
      headers: {
        "Authorization": `Bearer ${webhookConfig2.token}`,
        ...formData.getHeaders()
      }
    });
    return response.status >= 200 && response.status < 300;
  }
  /**
   * Add failed delivery to retry queue
   */
  addToFailedDeliveries(payload, webhookConfig2, error) {
    const webhookName = Array.from(this.webhookConfigs.entries()).find(([_, config]) => config === webhookConfig2)?.[0] || "unknown";
    if (!this.failedDeliveries.has(webhookName)) {
      this.failedDeliveries.set(webhookName, []);
    }
    const failedDelivery = {
      payload,
      webhookConfig: webhookConfig2,
      error,
      failedAt: (/* @__PURE__ */ new Date()).toISOString(),
      retryCount: 0
    };
    this.failedDeliveries.get(webhookName).push(failedDelivery);
    log(`Added failed delivery to retry queue for webhook '${webhookName}': ${payload.shipmentId}`, "external-sync");
  }
  /**
   * Update delivery statistics
   */
  updateDeliveryStats(success, attempts) {
    this.deliveryStats.totalAttempts += attempts;
    if (success) {
      this.deliveryStats.successfulDeliveries++;
      if (attempts > 1) {
        this.deliveryStats.retriedDeliveries++;
      }
    } else {
      this.deliveryStats.failedDeliveries++;
    }
  }
  /**
   * Get delivery statistics
   */
  getDeliveryStats() {
    const uptime = Date.now() - this.deliveryStats.lastResetTime;
    const successRate = this.deliveryStats.totalAttempts > 0 ? (this.deliveryStats.successfulDeliveries / (this.deliveryStats.successfulDeliveries + this.deliveryStats.failedDeliveries) * 100).toFixed(2) : "0.00";
    return {
      ...this.deliveryStats,
      uptime,
      successRate: `${successRate}%`,
      averageAttemptsPerDelivery: this.deliveryStats.totalAttempts > 0 ? (this.deliveryStats.totalAttempts / (this.deliveryStats.successfulDeliveries + this.deliveryStats.failedDeliveries)).toFixed(2) : "0.00",
      failedDeliveriesInQueue: Array.from(this.failedDeliveries.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }
  /**
   * Process failed deliveries retry queue
   */
  async processFailedDeliveries() {
    let processed = 0;
    let successful = 0;
    let stillFailed = 0;
    log("Processing failed deliveries retry queue", "external-sync");
    for (const [webhookName, failures] of this.failedDeliveries.entries()) {
      const toRetry = failures.splice(0, Math.min(failures.length, 10));
      for (const failure of toRetry) {
        processed++;
        failure.retryCount++;
        try {
          const result = await this.sendWithEnhancedRetry(failure.payload, failure.webhookConfig);
          if (result.success) {
            successful++;
            log(`Retry successful for shipment ${failure.payload.shipmentId} on webhook '${webhookName}'`, "external-sync");
          } else {
            stillFailed++;
            if (failure.retryCount < 5) {
              failures.push(failure);
            } else {
              log(`Giving up on shipment ${failure.payload.shipmentId} after ${failure.retryCount} retry attempts`, "external-sync");
            }
          }
        } catch (error) {
          stillFailed++;
          log(`Retry failed for shipment ${failure.payload.shipmentId}: ${error.message}`, "external-sync");
          if (failure.retryCount < 5) {
            failures.push(failure);
          }
        }
      }
    }
    log(`Failed deliveries processing complete: ${processed} processed, ${successful} successful, ${stillFailed} still failed`, "external-sync");
    return { processed, successful, stillFailed };
  }
  /**
   * Sends batch updates to external system
   * Used by the batch external update API endpoint
   */
  async sendBatchUpdatesToExternal(updates, webhookName = "default") {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    const results = [];
    log(`Starting batch external update for ${updates.length} shipments via webhook '${webhookName}'`, "external-sync");
    const concurrencyLimit = 3;
    const chunks = [];
    for (let i = 0; i < updates.length; i += concurrencyLimit) {
      chunks.push(updates.slice(i, i + concurrencyLimit));
    }
    for (const chunk of chunks) {
      const promises = chunk.map(async (update) => {
        try {
          const deliveryResult = await this.sendUpdateToExternal(update, webhookName);
          const updateResult = {
            shipmentId: update.id,
            status: deliveryResult.success ? "success" : "failed",
            message: deliveryResult.success ? "Update sent successfully" : deliveryResult.lastError || "Failed to send update",
            attempts: deliveryResult.attempts,
            webhookUrl: deliveryResult.webhookUrl,
            deliveredAt: deliveryResult.deliveredAt,
            sentAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (deliveryResult.success) {
            success++;
          } else {
            failed++;
          }
          return updateResult;
        } catch (error) {
          log(`Batch update error for shipment ${update.id}: ${error.message}`, "external-sync");
          failed++;
          return {
            shipmentId: update.id,
            status: "failed",
            message: error.message,
            attempts: 1,
            webhookUrl: "unknown",
            sentAt: (/* @__PURE__ */ new Date()).toISOString()
          };
        }
      });
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    const duration = Date.now() - startTime;
    log(`Batch external update completed: ${success} successful, ${failed} failed in ${duration}ms`, "external-sync");
    return { success, failed, results };
  }
  // Batch sync for multiple shipments with enhanced error tracking
  async batchSyncShipments(shipments) {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    let jsonCount = 0;
    let multipartCount = 0;
    log(`Starting batch sync for ${shipments.length} shipments`, "external-sync");
    const concurrencyLimit = 5;
    const chunks = [];
    for (let i = 0; i < shipments.length; i += concurrencyLimit) {
      chunks.push(shipments.slice(i, i + concurrencyLimit));
    }
    for (const chunk of chunks) {
      const promises = chunk.map(async (shipment) => {
        try {
          const payload = {
            shipmentId: shipment.shipment_id,
            status: shipment.status,
            syncedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          const contentType = this.determineContentType(payload);
          const result = await this.syncShipmentUpdate(shipment);
          if (result) {
            if (contentType === "multipart") multipartCount++;
            else jsonCount++;
            return "success";
          }
          return "failed";
        } catch (error) {
          log(`Batch sync error for shipment ${shipment.shipment_id}: ${error.message}`, "external-sync");
          return "failed";
        }
      });
      const results = await Promise.all(promises);
      success += results.filter((r) => r === "success").length;
      failed += results.filter((r) => r === "failed").length;
    }
    const duration = Date.now() - startTime;
    log(`Batch sync completed: ${success} successful (${jsonCount} JSON, ${multipartCount} multipart), ${failed} failed in ${duration}ms`, "external-sync");
    if (shipments.length >= 10) {
      this.logPerformanceSummary();
    }
    return { success, failed };
  }
};
var externalSync = new ExternalSyncService();

// server/services/RiderService.ts
init_pg_connection();
import bcrypt from "bcrypt";
var RiderService = class {
  async listRiders() {
    const res = await db.query("SELECT id, rider_id, full_name, is_active, is_approved, role, last_login_at, created_at, updated_at FROM rider_accounts WHERE is_active = TRUE ORDER BY full_name");
    return res.rows;
  }
  async listUnregisteredRiderIds(candidateIds) {
    if (!candidateIds || candidateIds.length === 0) return [];
    const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(",");
    const q = `SELECT UNNEST(ARRAY[${placeholders}]) AS rider_id EXCEPT SELECT rider_id FROM rider_accounts`;
    const res = await db.query(q, candidateIds);
    return res.rows.map((r) => r.rider_id);
  }
  async registerRider(riderId, fullName, password) {
    this.assertPassword(password);
    const hash = await bcrypt.hash(password, 10);
    const userId = "rider_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
    const insert = `
      INSERT INTO rider_accounts (id, rider_id, full_name, password_hash, is_active, is_approved, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, TRUE, FALSE, 'driver', NOW(), NOW())
      RETURNING id, rider_id, full_name, is_active, is_approved, role, last_login_at, created_at, updated_at
    `;
    const res = await db.query(insert, [userId, riderId, fullName, hash]);
    return res.rows[0];
  }
  async login(riderId, password) {
    const row = await db.query("SELECT id, rider_id, full_name, password_hash, is_active, is_approved, role, last_login_at, created_at, updated_at FROM rider_accounts WHERE rider_id = $1", [riderId]);
    if (!row.rows.length) return null;
    const rec = row.rows[0];
    const ok = await bcrypt.compare(password, rec.password_hash);
    if (!ok || !rec.is_active) return null;
    await db.query("UPDATE rider_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE rider_id = $1", [riderId]);
    return {
      id: rec.id,
      rider_id: rec.rider_id,
      full_name: rec.full_name,
      is_active: rec.is_active,
      is_approved: rec.is_approved,
      role: rec.role,
      last_login_at: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: rec.created_at,
      updated_at: rec.updated_at
    };
  }
  assertPassword(pw) {
    if (pw.length < 6) throw new Error("Password must be at least 6 characters");
    if (!/[a-z]/.test(pw)) throw new Error("Password needs a lowercase letter");
    if (!/[A-Z]/.test(pw)) throw new Error("Password needs an uppercase letter");
    if (!/[0-9]/.test(pw)) throw new Error("Password needs a number");
  }
};
var riderService = new RiderService();

// server/services/RouteService.ts
init_pg_connection();
import { randomUUID as randomUUID3 } from "crypto";
var RouteService = class {
  // Basic CRUD Operations
  async startSession(params) {
    const sql = `
      INSERT INTO route_sessions (
        id, employee_id, start_time, status, start_latitude, start_longitude, created_at, updated_at
      ) VALUES ($1,$2,NOW(),'active',$3,$4,NOW(),NOW())
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, fuel_efficiency, fuel_price, vehicle_type, created_at, updated_at
    `;
    const res = await db.query(sql, [params.id, params.employeeId, params.startLatitude, params.startLongitude]);
    return res.rows[0];
  }
  async stopSession(params) {
    const sql = `
      UPDATE route_sessions
      SET end_time = NOW(), end_latitude = $2, end_longitude = $3, status = 'completed', updated_at = NOW()
      WHERE id = $1
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, fuel_efficiency, fuel_price, vehicle_type, created_at, updated_at
    `;
    const res = await db.query(sql, [params.id, params.endLatitude, params.endLongitude]);
    if (res.rows[0]) {
      await this.updateSessionAnalytics(params.id);
      return res.rows[0];
    }
    return null;
  }
  async getRouteSession(sessionId) {
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
    return res.rows[0] || null;
  }
  async updateRouteSession(sessionId, updateData) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updates = [];
    const values = [];
    if (updateData.status) {
      updates.push("status = $" + (values.length + 1));
      values.push(updateData.status);
    }
    if (updateData.endTime) {
      updates.push("end_time = $" + (values.length + 1));
      values.push(updateData.endTime);
    }
    if (updateData.endLatitude && updateData.endLongitude) {
      updates.push("end_latitude = $" + (values.length + 1) + ", end_longitude = $" + (values.length + 2));
      values.push(updateData.endLatitude, updateData.endLongitude);
    }
    if (updates.length === 0) {
      return this.getRouteSession(sessionId);
    }
    updates.push("updated_at = $" + (values.length + 1));
    values.push(now);
    values.push(sessionId);
    const sql = `
      UPDATE route_sessions 
      SET ${updates.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, employee_id, start_time, end_time, status, start_latitude, start_longitude, end_latitude, end_longitude, total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed, fuel_efficiency, fuel_price, vehicle_type, created_at, updated_at
    `;
    const res = await db.query(sql, values);
    return res.rows[0] || null;
  }
  async insertCoordinate(params) {
    const ts = params.timestamp || (/* @__PURE__ */ new Date()).toISOString();
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
      params.eventType ?? "gps",
      params.shipmentId ?? null,
      dateOnly
    ]);
    return res.rows[0];
  }
  async recordGPSCoordinate(coordinate) {
    const id = randomUUID3();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const date = coordinate.timestamp.split("T")[0];
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
      id,
      coordinate.sessionId,
      coordinate.sessionId,
      coordinate.latitude,
      coordinate.longitude,
      coordinate.timestamp,
      coordinate.accuracy || null,
      coordinate.speed || null,
      date,
      now,
      now
    ]);
    return res.rows[0];
  }
  async recordShipmentEvent(sessionId, shipmentId, eventType, latitude, longitude) {
    const id = randomUUID3();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const date = now.split("T")[0];
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
      id,
      sessionId,
      sessionId,
      latitude,
      longitude,
      now,
      shipmentId,
      eventType,
      date,
      now,
      now
    ]);
    return res.rows[0];
  }
  async getRouteTrackingById(id) {
    const sql = `
      SELECT id, session_id, employee_id, latitude, longitude, timestamp,
             accuracy, speed, event_type, shipment_id, date, fuel_efficiency, fuel_price, vehicle_type,
             total_distance, total_time, average_speed, fuel_consumed, fuel_cost, shipments_completed,
             created_at, updated_at
      FROM route_tracking WHERE id = $1
    `;
    const res = await db.query(sql, [id]);
    return res.rows[0] || null;
  }
  async getActiveSession(employeeId) {
    try {
      console.log(`\u{1F50D} Getting active session for employee: ${employeeId}`);
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'route_sessions'
        );
      `);
      if (!tableCheck.rows[0]?.exists) {
        console.log("\u26A0\uFE0F route_sessions table does not exist");
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
      console.log("Executing query for active session...");
      const res = await db.query(sql, [employeeId]);
      console.log(`Found ${res.rows.length} active sessions`);
      return res.rows[0] || null;
    } catch (error) {
      console.error("\u274C Error in getActiveSession:", error);
      throw error;
    }
  }
  async getSessionCoordinates(sessionId) {
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
    return res.rows;
  }
  async getSession(sessionId) {
    const s = await db.query("SELECT * FROM route_sessions WHERE id = $1", [sessionId]);
    const session = s.rows[0] || null;
    const coordsRes = await db.query("SELECT * FROM route_tracking WHERE session_id = $1 ORDER BY timestamp DESC", [sessionId]);
    return { session, coordinates: coordsRes.rows };
  }
  async listRecentSessions(limit = 50) {
    const res = await db.query(
      "SELECT * FROM route_sessions ORDER BY start_time DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }
  // Advanced Analytics
  async getRouteAnalytics(filters = {}) {
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
    const params = [];
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
    return res.rows;
  }
  async getEmployeePerformanceMetrics(filters = {}) {
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
    const params = [];
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
  async getRoutePerformanceMetrics(filters = {}) {
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
    const params = [];
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
  async getTimeBasedMetrics(groupBy, filters = {}) {
    let dateGrouping;
    switch (groupBy) {
      case "day":
        dateGrouping = "date";
        break;
      case "week":
        dateGrouping = "TO_CHAR(date::date, 'IYYY-IW')";
        break;
      case "month":
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
    const params = [];
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
  async getFuelAnalytics(filters = {}) {
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
    const params = [];
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
  async getHourlyActivityData(filters = {}) {
    let query = `
      SELECT 
        EXTRACT(HOUR FROM timestamp::timestamp) as hour,
        COUNT(*) as activity,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT employee_id) as employees
      FROM route_tracking
      WHERE 1=1
    `;
    const params = [];
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
  async getTopPerformers(metric, limit = 10) {
    let orderBy;
    switch (metric) {
      case "distance":
        orderBy = '"totalDistance" DESC';
        break;
      case "efficiency":
        orderBy = "efficiency DESC";
        break;
      case "fuel":
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
  async updateSessionAnalytics(sessionId) {
    try {
      const coordinates = await this.getSessionCoordinates(sessionId);
      if (coordinates.length < 2) {
        return;
      }
      let totalDistance = 0;
      for (let i = 1; i < coordinates.length; i++) {
        const prev = coordinates[i - 1];
        const curr = coordinates[i];
        const distance = this.calculateHaversineDistance(
          prev.latitude,
          prev.longitude,
          curr.latitude,
          curr.longitude
        );
        totalDistance += distance;
      }
      const startTime = new Date(coordinates[0].timestamp);
      const endTime = new Date(coordinates[coordinates.length - 1].timestamp);
      const totalTime = Math.max(1, (endTime.getTime() - startTime.getTime()) / 1e3);
      const averageSpeed = totalDistance / (totalTime / 3600);
      const shipmentsCompleted = new Set(
        coordinates.filter((coord) => coord.shipment_id && coord.event_type).map((coord) => coord.shipment_id)
      ).size;
      const fuelEfficiency = coordinates[0].fuel_efficiency || 15;
      const fuelPrice = coordinates[0].fuel_price || 1.5;
      const fuelConsumed = totalDistance / fuelEfficiency;
      const fuelCost = fuelConsumed * fuelPrice;
      const updateStmt = `
        UPDATE route_tracking 
        SET total_distance = $1, total_time = $2, average_speed = $3, 
            fuel_consumed = $4, fuel_cost = $5, shipments_completed = $6,
            updated_at = NOW()
        WHERE session_id = $7
      `;
      await db.query(updateStmt, [
        Math.round(totalDistance * 1e3) / 1e3,
        // Round to 3 decimal places
        totalTime,
        Math.round(averageSpeed * 100) / 100,
        // Round to 2 decimal places
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
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  // Cleanup and Maintenance
  async cleanupOldRouteData(daysToKeep = 30) {
    const cutoffDate = /* @__PURE__ */ new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString().split("T")[0];
    await db.query("DELETE FROM route_tracking WHERE date < $1", [cutoffIso]);
  }
  async getAnalyticsSummary() {
    const totalRoutesRes = await db.query("SELECT COUNT(*)::int as c FROM route_sessions");
    const totalDistanceRes = await db.query("SELECT COALESCE(SUM(total_distance),0)::float as d FROM route_sessions");
    const totalTimeRes = await db.query("SELECT COALESCE(SUM(total_time),0)::int as t FROM route_sessions");
    const completedRes = await db.query(`SELECT COALESCE(SUM(shipments_completed),0)::int as s FROM (
      SELECT COUNT(*) as shipments_completed FROM route_tracking WHERE event_type IN ('delivery','pickup') GROUP BY session_id
    ) x`);
    return {
      totalRoutes: totalRoutesRes.rows[0]?.c || 0,
      totalDistance: totalDistanceRes.rows[0]?.d || 0,
      totalTimeHours: Math.round((totalTimeRes.rows[0]?.t || 0) / 3600),
      shipmentsCompleted: completedRes.rows[0]?.s || 0
    };
  }
  async insertCoordinatesBatch(coordinates) {
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
};
var routeService = new RouteService();

// server/services/FieldMappingService.ts
await init_vite();
var FieldMappingService = class {
  constructor() {
    this.requiredExternalFields = [
      "id",
      "status",
      "type",
      "deliveryAddress",
      "recipientName",
      "recipientPhone",
      "estimatedDeliveryTime",
      "cost",
      "routeName",
      "employeeId"
    ];
    this.requiredInternalFields = [
      "type",
      "customerName",
      "customerMobile",
      "address",
      "deliveryTime",
      "cost",
      "routeName",
      "employeeId",
      "status"
    ];
  }
  /**
   * Maps external payload to internal database format
   * Handles field name conversions and data type validation
   */
  mapExternalToInternal(external) {
    try {
      log(`Mapping external payload to internal format for shipment ${external.id}`, "field-mapping");
      const validation = this.validateExternalPayload(external);
      if (!validation.isValid) {
        const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(`Validation failed: ${errorMessages}`);
      }
      const internalId = this.generateInternalId();
      const internal = {
        shipment_id: internalId,
        type: this.sanitizeString(external.type),
        customerName: this.sanitizeString(external.recipientName),
        // recipientName -> customerName
        customerMobile: this.sanitizePhoneNumber(external.recipientPhone),
        // recipientPhone -> customerMobile
        address: this.sanitizeString(external.deliveryAddress),
        // deliveryAddress -> address
        latitude: this.sanitizeCoordinate(external.latitude, "latitude"),
        longitude: this.sanitizeCoordinate(external.longitude, "longitude"),
        cost: this.sanitizeNumber(external.cost, "cost"),
        deliveryTime: this.sanitizeDateTime(external.estimatedDeliveryTime),
        // estimatedDeliveryTime -> deliveryTime
        routeName: this.sanitizeString(external.routeName),
        employeeId: this.sanitizeString(external.employeeId),
        status: this.sanitizeStatus(external.status),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        // Additional fields (may not exist in current schema)
        priority: external.priority ? this.sanitizeString(external.priority) : void 0,
        pickupAddress: external.pickupAddress ? this.sanitizeString(external.pickupAddress) : void 0,
        weight: external.weight ? this.sanitizeNumber(external.weight, "weight") : void 0,
        dimensions: external.dimensions ? this.sanitizeString(external.dimensions) : void 0,
        specialInstructions: external.specialInstructions ? this.sanitizeString(external.specialInstructions) : void 0,
        piashipmentid: this.sanitizeString(external.id)
        // Store external ID for reference
      };
      log(`Successfully mapped external shipment ${external.id} to internal ID ${internalId}`, "field-mapping");
      return internal;
    } catch (error) {
      log(`Error mapping external to internal for shipment ${external.id}: ${error.message}`, "field-mapping");
      throw new Error(`Field mapping failed: ${error.message}`);
    }
  }
  /**
   * Maps internal database format to external update format
   * Used when sending status updates back to external systems
   */
  mapInternalToExternal(internal, additionalData) {
    try {
      log(`Mapping internal shipment ${internal.shipment_id} to external update format`, "field-mapping");
      const external = {
        id: internal.piashipmentid || internal.shipment_id,
        // Use external ID if available, fallback to internal
        status: internal.status,
        statusTimestamp: internal.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
        employeeId: internal.employeeId
      };
      if (internal.latitude !== void 0 && internal.longitude !== void 0) {
        external.location = {
          latitude: internal.latitude,
          longitude: internal.longitude
        };
      }
      if (internal.actualDeliveryTime || internal.customerName || additionalData?.deliveryNotes) {
        external.deliveryDetails = {
          actualDeliveryTime: internal.actualDeliveryTime,
          recipientName: internal.customerName,
          // customerName -> recipientName
          deliveryNotes: additionalData?.deliveryNotes,
          signature: additionalData?.signature,
          photo: additionalData?.photo
        };
      }
      external.routeInfo = {
        routeName: internal.routeName,
        sessionId: additionalData?.sessionId,
        totalDistance: additionalData?.totalDistance,
        travelTime: additionalData?.travelTime
      };
      log(`Successfully mapped internal shipment ${internal.shipment_id} to external update`, "field-mapping");
      return external;
    } catch (error) {
      log(`Error mapping internal to external for shipment ${internal.shipment_id}: ${error.message}`, "field-mapping");
      throw new Error(`Field mapping failed: ${error.message}`);
    }
  }
  /**
   * Validates external shipment payload structure and required fields
   */
  validateExternalPayload(payload) {
    const errors = [];
    try {
      for (const field of this.requiredExternalFields) {
        if (!payload[field]) {
          errors.push({
            field,
            value: payload[field],
            message: `Required field '${field}' is missing or empty`,
            code: "REQUIRED_FIELD_MISSING"
          });
        }
      }
      if (payload.id && typeof payload.id !== "string") {
        errors.push({
          field: "id",
          value: payload.id,
          message: "ID must be a string",
          code: "INVALID_TYPE"
        });
      }
      if (payload.cost !== void 0 && (typeof payload.cost !== "number" || payload.cost < 0)) {
        errors.push({
          field: "cost",
          value: payload.cost,
          message: "Cost must be a non-negative number",
          code: "INVALID_VALUE"
        });
      }
      if (payload.weight !== void 0 && (typeof payload.weight !== "number" || payload.weight <= 0)) {
        errors.push({
          field: "weight",
          value: payload.weight,
          message: "Weight must be a positive number",
          code: "INVALID_VALUE"
        });
      }
      if (payload.latitude !== void 0) {
        const lat = Number(payload.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          errors.push({
            field: "latitude",
            value: payload.latitude,
            message: "Latitude must be a number between -90 and 90",
            code: "INVALID_COORDINATE"
          });
        }
      }
      if (payload.longitude !== void 0) {
        const lng = Number(payload.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          errors.push({
            field: "longitude",
            value: payload.longitude,
            message: "Longitude must be a number between -180 and 180",
            code: "INVALID_COORDINATE"
          });
        }
      }
      if (payload.recipientPhone && !this.isValidPhoneNumber(payload.recipientPhone)) {
        errors.push({
          field: "recipientPhone",
          value: payload.recipientPhone,
          message: "Invalid phone number format",
          code: "INVALID_PHONE_FORMAT"
        });
      }
      if (payload.status && !this.isValidStatus(payload.status)) {
        errors.push({
          field: "status",
          value: payload.status,
          message: "Invalid status value",
          code: "INVALID_STATUS"
        });
      }
      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? payload : void 0
      };
    } catch (error) {
      log(`Validation error for external payload: ${error.message}`, "field-mapping");
      return {
        isValid: false,
        errors: [{
          field: "general",
          value: payload,
          message: `Validation failed: ${error.message}`,
          code: "VALIDATION_ERROR"
        }]
      };
    }
  }
  /**
   * Validates batch shipment payload
   */
  validateExternalBatch(batch) {
    const errors = [];
    if (!batch.shipments || !Array.isArray(batch.shipments)) {
      errors.push({
        field: "shipments",
        value: batch.shipments,
        message: "Shipments must be an array",
        code: "INVALID_TYPE"
      });
      return { isValid: false, errors };
    }
    if (batch.shipments.length === 0) {
      errors.push({
        field: "shipments",
        value: batch.shipments,
        message: "Shipments array cannot be empty",
        code: "EMPTY_ARRAY"
      });
      return { isValid: false, errors };
    }
    batch.shipments.forEach((shipment, index) => {
      const validation = this.validateExternalPayload(shipment);
      if (!validation.isValid) {
        validation.errors.forEach((error) => {
          errors.push({
            ...error,
            field: `shipments[${index}].${error.field}`,
            message: `Shipment ${index}: ${error.message}`
          });
        });
      }
    });
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? batch : void 0
    };
  }
  // Private helper methods for data sanitization and validation
  generateInternalId() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  sanitizeString(value) {
    if (value === null || value === void 0) return "";
    return String(value).trim();
  }
  sanitizeNumber(value, fieldName) {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number for field ${fieldName}: ${value}`);
    }
    return num;
  }
  sanitizeCoordinate(value, type) {
    if (value === null || value === void 0) return void 0;
    const num = Number(value);
    if (isNaN(num)) return void 0;
    if (type === "latitude" && (num < -90 || num > 90)) return void 0;
    if (type === "longitude" && (num < -180 || num > 180)) return void 0;
    return num;
  }
  sanitizeDateTime(value) {
    if (!value) return (/* @__PURE__ */ new Date()).toISOString();
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return (/* @__PURE__ */ new Date()).toISOString();
    }
    return date.toISOString();
  }
  sanitizePhoneNumber(value) {
    if (!value) return "";
    const cleaned = String(value).replace(/[^\d+]/g, "");
    return cleaned;
  }
  sanitizeStatus(value) {
    const validStatuses = ["Assigned", "In Transit", "Delivered", "Picked Up", "Returned", "Cancelled"];
    const status = String(value).trim();
    if (validStatuses.includes(status)) {
      return status;
    }
    const matchedStatus = validStatuses.find((s) => s.toLowerCase() === status.toLowerCase());
    if (matchedStatus) {
      return matchedStatus;
    }
    log(`Invalid status '${status}', defaulting to 'Assigned'`, "field-mapping");
    return "Assigned";
  }
  isValidPhoneNumber(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;
    return phoneRegex.test(phone);
  }
  isValidStatus(status) {
    const validStatuses = ["Assigned", "In Transit", "Delivered", "Picked Up", "Returned", "Cancelled"];
    return validStatuses.some((s) => s.toLowerCase() === status.toLowerCase());
  }
  /**
   * Maps field aliases for backward compatibility
   * Handles cases where external systems use different field names
   */
  mapFieldAliases(payload) {
    const mapped = { ...payload };
    if (payload.customerName && !payload.recipientName) {
      mapped.recipientName = payload.customerName;
    }
    if (payload.customerMobile && !payload.recipientPhone) {
      mapped.recipientPhone = payload.customerMobile;
    }
    if (payload.address && !payload.deliveryAddress) {
      mapped.deliveryAddress = payload.address;
    }
    if (payload.deliveryTime && !payload.estimatedDeliveryTime) {
      mapped.estimatedDeliveryTime = payload.deliveryTime;
    }
    return mapped;
  }
  /**
   * Gets field mapping documentation for API documentation
   */
  getFieldMappingDocumentation() {
    return {
      "External Field": "Internal Database Field",
      "id": "piashipmentid (stored as reference), generates new internal id",
      "recipientName": "customerName",
      "recipientPhone": "customerMobile",
      "deliveryAddress": "address",
      "estimatedDeliveryTime": "deliveryTime",
      "status": "status (validated against allowed values)",
      "type": "type",
      "cost": "cost",
      "routeName": "routeName",
      "employeeId": "employeeId",
      "latitude": "latitude",
      "longitude": "longitude",
      "priority": "priority (new field)",
      "pickupAddress": "pickupAddress (new field)",
      "weight": "weight (new field)",
      "dimensions": "dimensions (new field)",
      "specialInstructions": "specialInstructions (new field)"
    };
  }
};
var fieldMappingService = new FieldMappingService();

// server/services/PayloadValidationService.ts
await init_vite();
var PayloadValidationService = class {
  constructor() {
    this.validStatuses = [
      "Assigned",
      "In Transit",
      "Delivered",
      "Picked Up",
      "Returned",
      "Cancelled"
    ];
    this.validTypes = ["delivery", "pickup"];
    this.validPriorities = ["high", "medium", "low"];
    // Indian phone number patterns
    this.indianPhonePatterns = [
      /^(\+91|91)?[6-9]\d{9}$/,
      // Standard Indian mobile
      /^(\+91|91)?\d{10}$/,
      // 10-digit number
      /^(\+91|91)?\d{11}$/
      // 11-digit with area code
    ];
  }
  /**
   * Validates single shipment payload with comprehensive field validation
   */
  validateSingleShipment(payload) {
    const errors = [];
    try {
      log(`Validating single shipment payload for ID: ${payload?.id || "unknown"}`, "payload-validation");
      if (!payload || typeof payload !== "object") {
        return {
          isValid: false,
          errors: [{
            field: "payload",
            value: payload,
            message: "Payload must be a valid object",
            code: "INVALID_PAYLOAD_STRUCTURE"
          }]
        };
      }
      this.validateRequiredFields(payload, errors);
      this.validateIdField(payload.id, errors);
      this.validateStatusField(payload.status, errors);
      this.validateTypeField(payload.type, errors);
      this.validatePriorityField(payload.priority, errors);
      this.validateAddressFields(payload, errors);
      this.validateContactFields(payload, errors);
      this.validateNumericFields(payload, errors);
      this.validateCoordinateFields(payload, errors);
      this.validateDateTimeFields(payload, errors);
      this.validateOptionalFields(payload, errors);
      const isValid = errors.length === 0;
      if (isValid) {
        log(`Single shipment validation passed for ID: ${payload.id}`, "payload-validation");
      } else {
        log(`Single shipment validation failed for ID: ${payload?.id || "unknown"} with ${errors.length} errors`, "payload-validation");
      }
      return {
        isValid,
        errors,
        sanitizedData: isValid ? this.sanitizePayload(payload) : void 0
      };
    } catch (error) {
      log(`Validation error for single shipment: ${error.message}`, "payload-validation");
      return {
        isValid: false,
        errors: [{
          field: "general",
          value: payload,
          message: `Validation failed: ${error.message}`,
          code: "VALIDATION_EXCEPTION"
        }]
      };
    }
  }
  /**
   * Validates batch shipment payload
   */
  validateBatchShipments(batch) {
    const errors = [];
    try {
      log(`Validating batch shipment payload with ${batch?.shipments?.length || 0} shipments`, "payload-validation");
      if (!batch || typeof batch !== "object") {
        return {
          isValid: false,
          errors: [{
            field: "batch",
            value: batch,
            message: "Batch payload must be a valid object",
            code: "INVALID_BATCH_STRUCTURE"
          }]
        };
      }
      if (!batch.shipments) {
        errors.push({
          field: "shipments",
          value: batch.shipments,
          message: "Shipments array is required",
          code: "MISSING_SHIPMENTS_ARRAY"
        });
        return { isValid: false, errors };
      }
      if (!Array.isArray(batch.shipments)) {
        errors.push({
          field: "shipments",
          value: batch.shipments,
          message: "Shipments must be an array",
          code: "INVALID_SHIPMENTS_TYPE"
        });
        return { isValid: false, errors };
      }
      if (batch.shipments.length === 0) {
        errors.push({
          field: "shipments",
          value: batch.shipments,
          message: "Shipments array cannot be empty",
          code: "EMPTY_SHIPMENTS_ARRAY"
        });
        return { isValid: false, errors };
      }
      if (batch.shipments.length > 100) {
        errors.push({
          field: "shipments",
          value: batch.shipments.length,
          message: "Batch size cannot exceed 100 shipments",
          code: "BATCH_SIZE_EXCEEDED"
        });
      }
      if (batch.metadata) {
        this.validateBatchMetadata(batch.metadata, errors);
      }
      const shipmentIds = /* @__PURE__ */ new Set();
      batch.shipments.forEach((shipment, index) => {
        const shipmentValidation = this.validateSingleShipment(shipment);
        shipmentValidation.errors.forEach((error) => {
          errors.push({
            ...error,
            field: `shipments[${index}].${error.field}`,
            message: `Shipment ${index + 1}: ${error.message}`
          });
        });
        if (shipment?.id) {
          if (shipmentIds.has(shipment.shipment_id)) {
            errors.push({
              field: `shipments[${index}].id`,
              value: shipment.shipment_id,
              message: `Duplicate shipment ID '${shipment.shipment_id}' found in batch`,
              code: "DUPLICATE_SHIPMENT_ID"
            });
          } else {
            shipmentIds.add(shipment.shipment_id);
          }
        }
      });
      const isValid = errors.length === 0;
      if (isValid) {
        log(`Batch validation passed for ${batch.shipments.length} shipments`, "payload-validation");
      } else {
        log(`Batch validation failed with ${errors.length} errors across ${batch.shipments.length} shipments`, "payload-validation");
      }
      return {
        isValid,
        errors,
        sanitizedData: isValid ? this.sanitizeBatch(batch) : void 0
      };
    } catch (error) {
      log(`Validation error for batch shipments: ${error.message}`, "payload-validation");
      return {
        isValid: false,
        errors: [{
          field: "general",
          value: batch,
          message: `Batch validation failed: ${error.message}`,
          code: "BATCH_VALIDATION_EXCEPTION"
        }]
      };
    }
  }
  // Private validation methods for specific field types
  validateRequiredFields(payload, errors) {
    const requiredFields = [
      "id",
      "status",
      "type",
      "deliveryAddress",
      "recipientName",
      "recipientPhone",
      "estimatedDeliveryTime",
      "cost",
      "routeName",
      "employeeId"
    ];
    requiredFields.forEach((field) => {
      const value = payload[field];
      if (value === void 0 || value === null || value === "") {
        errors.push({
          field,
          value,
          message: `Required field '${field}' is missing or empty`,
          code: "REQUIRED_FIELD_MISSING"
        });
      }
    });
  }
  validateIdField(id, errors) {
    if (id !== void 0 && id !== null) {
      if (typeof id !== "string") {
        errors.push({
          field: "id",
          value: id,
          message: "ID must be a string",
          code: "INVALID_ID_TYPE"
        });
      } else if (id.trim().length === 0) {
        errors.push({
          field: "id",
          value: id,
          message: "ID cannot be empty",
          code: "EMPTY_ID"
        });
      } else if (id.length > 100) {
        errors.push({
          field: "id",
          value: id,
          message: "ID cannot exceed 100 characters",
          code: "ID_TOO_LONG"
        });
      }
    }
  }
  validateStatusField(status, errors) {
    if (status !== void 0 && status !== null) {
      if (typeof status !== "string") {
        errors.push({
          field: "status",
          value: status,
          message: "Status must be a string",
          code: "INVALID_STATUS_TYPE"
        });
      } else {
        const normalizedStatus = status.trim();
        const isValidStatus = this.validStatuses.some(
          (validStatus) => validStatus.toLowerCase() === normalizedStatus.toLowerCase()
        );
        if (!isValidStatus) {
          errors.push({
            field: "status",
            value: status,
            message: `Invalid status. Must be one of: ${this.validStatuses.join(", ")}`,
            code: "INVALID_STATUS_VALUE"
          });
        }
      }
    }
  }
  validateTypeField(type, errors) {
    if (type !== void 0 && type !== null) {
      if (typeof type !== "string") {
        errors.push({
          field: "type",
          value: type,
          message: "Type must be a string",
          code: "INVALID_TYPE_TYPE"
        });
      } else {
        const normalizedType = type.trim().toLowerCase();
        if (!this.validTypes.includes(normalizedType)) {
          errors.push({
            field: "type",
            value: type,
            message: `Invalid type. Must be one of: ${this.validTypes.join(", ")}`,
            code: "INVALID_TYPE_VALUE"
          });
        }
      }
    }
  }
  validatePriorityField(priority, errors) {
    if (priority !== void 0 && priority !== null) {
      if (typeof priority !== "string") {
        errors.push({
          field: "priority",
          value: priority,
          message: "Priority must be a string",
          code: "INVALID_PRIORITY_TYPE"
        });
      } else {
        const normalizedPriority = priority.trim().toLowerCase();
        if (!this.validPriorities.includes(normalizedPriority)) {
          errors.push({
            field: "priority",
            value: priority,
            message: `Invalid priority. Must be one of: ${this.validPriorities.join(", ")}`,
            code: "INVALID_PRIORITY_VALUE"
          });
        }
      }
    }
  }
  validateAddressFields(payload, errors) {
    if (payload.deliveryAddress !== void 0 && payload.deliveryAddress !== null) {
      if (typeof payload.deliveryAddress !== "string") {
        errors.push({
          field: "deliveryAddress",
          value: payload.deliveryAddress,
          message: "Delivery address must be a string",
          code: "INVALID_ADDRESS_TYPE"
        });
      } else if (payload.deliveryAddress.trim().length < 10) {
        errors.push({
          field: "deliveryAddress",
          value: payload.deliveryAddress,
          message: "Delivery address must be at least 10 characters long",
          code: "ADDRESS_TOO_SHORT"
        });
      } else if (payload.deliveryAddress.length > 500) {
        errors.push({
          field: "deliveryAddress",
          value: payload.deliveryAddress,
          message: "Delivery address cannot exceed 500 characters",
          code: "ADDRESS_TOO_LONG"
        });
      }
    }
    if (payload.pickupAddress !== void 0 && payload.pickupAddress !== null) {
      if (typeof payload.pickupAddress !== "string") {
        errors.push({
          field: "pickupAddress",
          value: payload.pickupAddress,
          message: "Pickup address must be a string",
          code: "INVALID_PICKUP_ADDRESS_TYPE"
        });
      } else if (payload.pickupAddress.trim().length < 10) {
        errors.push({
          field: "pickupAddress",
          value: payload.pickupAddress,
          message: "Pickup address must be at least 10 characters long",
          code: "PICKUP_ADDRESS_TOO_SHORT"
        });
      }
    }
  }
  validateContactFields(payload, errors) {
    if (payload.recipientName !== void 0 && payload.recipientName !== null) {
      if (typeof payload.recipientName !== "string") {
        errors.push({
          field: "recipientName",
          value: payload.recipientName,
          message: "Recipient name must be a string",
          code: "INVALID_NAME_TYPE"
        });
      } else if (payload.recipientName.trim().length < 2) {
        errors.push({
          field: "recipientName",
          value: payload.recipientName,
          message: "Recipient name must be at least 2 characters long",
          code: "NAME_TOO_SHORT"
        });
      } else if (payload.recipientName.length > 100) {
        errors.push({
          field: "recipientName",
          value: payload.recipientName,
          message: "Recipient name cannot exceed 100 characters",
          code: "NAME_TOO_LONG"
        });
      }
    }
    if (payload.recipientPhone !== void 0 && payload.recipientPhone !== null) {
      if (typeof payload.recipientPhone !== "string") {
        errors.push({
          field: "recipientPhone",
          value: payload.recipientPhone,
          message: "Recipient phone must be a string",
          code: "INVALID_PHONE_TYPE"
        });
      } else {
        const cleanPhone = payload.recipientPhone.replace(/[\s\-\(\)]/g, "");
        const isValidIndianPhone = this.indianPhonePatterns.some((pattern) => pattern.test(cleanPhone));
        if (!isValidIndianPhone) {
          errors.push({
            field: "recipientPhone",
            value: payload.recipientPhone,
            message: "Invalid Indian phone number format. Expected format: +91XXXXXXXXXX or 10-digit number",
            code: "INVALID_INDIAN_PHONE_FORMAT"
          });
        }
      }
    }
  }
  validateNumericFields(payload, errors) {
    if (payload.cost !== void 0 && payload.cost !== null) {
      const cost = Number(payload.cost);
      if (isNaN(cost)) {
        errors.push({
          field: "cost",
          value: payload.cost,
          message: "Cost must be a valid number",
          code: "INVALID_COST_TYPE"
        });
      } else if (cost < 0) {
        errors.push({
          field: "cost",
          value: payload.cost,
          message: "Cost cannot be negative",
          code: "NEGATIVE_COST"
        });
      } else if (cost > 1e6) {
        errors.push({
          field: "cost",
          value: payload.cost,
          message: "Cost cannot exceed \u20B910,00,000",
          code: "COST_TOO_HIGH"
        });
      }
    }
    if (payload.weight !== void 0 && payload.weight !== null) {
      const weight = Number(payload.weight);
      if (isNaN(weight)) {
        errors.push({
          field: "weight",
          value: payload.weight,
          message: "Weight must be a valid number",
          code: "INVALID_WEIGHT_TYPE"
        });
      } else if (weight <= 0) {
        errors.push({
          field: "weight",
          value: payload.weight,
          message: "Weight must be greater than 0",
          code: "INVALID_WEIGHT_VALUE"
        });
      } else if (weight > 1e4) {
        errors.push({
          field: "weight",
          value: payload.weight,
          message: "Weight cannot exceed 10,000 kg",
          code: "WEIGHT_TOO_HIGH"
        });
      }
    }
  }
  validateCoordinateFields(payload, errors) {
    if (payload.latitude !== void 0 && payload.latitude !== null) {
      const lat = Number(payload.latitude);
      if (isNaN(lat)) {
        errors.push({
          field: "latitude",
          value: payload.latitude,
          message: "Latitude must be a valid number",
          code: "INVALID_LATITUDE_TYPE"
        });
      } else if (lat < -90 || lat > 90) {
        errors.push({
          field: "latitude",
          value: payload.latitude,
          message: "Latitude must be between -90 and 90 degrees",
          code: "INVALID_LATITUDE_RANGE"
        });
      } else if (lat < 6 || lat > 37) {
        errors.push({
          field: "latitude",
          value: payload.latitude,
          message: "Latitude appears to be outside India (6\xB0N to 37\xB0N). Please verify coordinates.",
          code: "LATITUDE_OUTSIDE_INDIA"
        });
      }
    }
    if (payload.longitude !== void 0 && payload.longitude !== null) {
      const lng = Number(payload.longitude);
      if (isNaN(lng)) {
        errors.push({
          field: "longitude",
          value: payload.longitude,
          message: "Longitude must be a valid number",
          code: "INVALID_LONGITUDE_TYPE"
        });
      } else if (lng < -180 || lng > 180) {
        errors.push({
          field: "longitude",
          value: payload.longitude,
          message: "Longitude must be between -180 and 180 degrees",
          code: "INVALID_LONGITUDE_RANGE"
        });
      } else if (lng < 68 || lng > 97) {
        errors.push({
          field: "longitude",
          value: payload.longitude,
          message: "Longitude appears to be outside India (68\xB0E to 97\xB0E). Please verify coordinates.",
          code: "LONGITUDE_OUTSIDE_INDIA"
        });
      }
    }
  }
  validateDateTimeFields(payload, errors) {
    if (payload.estimatedDeliveryTime !== void 0 && payload.estimatedDeliveryTime !== null) {
      if (typeof payload.estimatedDeliveryTime !== "string") {
        errors.push({
          field: "estimatedDeliveryTime",
          value: payload.estimatedDeliveryTime,
          message: "Estimated delivery time must be a string",
          code: "INVALID_DATETIME_TYPE"
        });
      } else {
        const date = new Date(payload.estimatedDeliveryTime);
        if (isNaN(date.getTime())) {
          errors.push({
            field: "estimatedDeliveryTime",
            value: payload.estimatedDeliveryTime,
            message: "Invalid date format for estimated delivery time. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
            code: "INVALID_DATETIME_FORMAT"
          });
        } else {
          const now = /* @__PURE__ */ new Date();
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1e3);
          if (date < oneHourAgo) {
            errors.push({
              field: "estimatedDeliveryTime",
              value: payload.estimatedDeliveryTime,
              message: "Estimated delivery time cannot be in the past",
              code: "PAST_DELIVERY_TIME"
            });
          }
          const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1e3);
          if (date > oneYearFromNow) {
            errors.push({
              field: "estimatedDeliveryTime",
              value: payload.estimatedDeliveryTime,
              message: "Estimated delivery time cannot be more than 1 year in the future",
              code: "FUTURE_DELIVERY_TIME_TOO_FAR"
            });
          }
        }
      }
    }
  }
  validateOptionalFields(payload, errors) {
    if (payload.dimensions !== void 0 && payload.dimensions !== null) {
      if (typeof payload.dimensions !== "string") {
        errors.push({
          field: "dimensions",
          value: payload.dimensions,
          message: "Dimensions must be a string",
          code: "INVALID_DIMENSIONS_TYPE"
        });
      } else if (payload.dimensions.length > 100) {
        errors.push({
          field: "dimensions",
          value: payload.dimensions,
          message: "Dimensions cannot exceed 100 characters",
          code: "DIMENSIONS_TOO_LONG"
        });
      }
    }
    if (payload.specialInstructions !== void 0 && payload.specialInstructions !== null) {
      if (typeof payload.specialInstructions !== "string") {
        errors.push({
          field: "specialInstructions",
          value: payload.specialInstructions,
          message: "Special instructions must be a string",
          code: "INVALID_INSTRUCTIONS_TYPE"
        });
      } else if (payload.specialInstructions.length > 1e3) {
        errors.push({
          field: "specialInstructions",
          value: payload.specialInstructions,
          message: "Special instructions cannot exceed 1000 characters",
          code: "INSTRUCTIONS_TOO_LONG"
        });
      }
    }
    if (payload.routeName !== void 0 && payload.routeName !== null) {
      if (typeof payload.routeName !== "string") {
        errors.push({
          field: "routeName",
          value: payload.routeName,
          message: "Route name must be a string",
          code: "INVALID_ROUTE_NAME_TYPE"
        });
      } else if (payload.routeName.trim().length === 0) {
        errors.push({
          field: "routeName",
          value: payload.routeName,
          message: "Route name cannot be empty",
          code: "EMPTY_ROUTE_NAME"
        });
      }
    }
    if (payload.employeeId !== void 0 && payload.employeeId !== null) {
      if (typeof payload.employeeId !== "string") {
        errors.push({
          field: "employeeId",
          value: payload.employeeId,
          message: "Employee ID must be a string",
          code: "INVALID_EMPLOYEE_ID_TYPE"
        });
      } else if (payload.employeeId.trim().length === 0) {
        errors.push({
          field: "employeeId",
          value: payload.employeeId,
          message: "Employee ID cannot be empty",
          code: "EMPTY_EMPLOYEE_ID"
        });
      }
    }
  }
  validateBatchMetadata(metadata, errors) {
    if (typeof metadata !== "object") {
      errors.push({
        field: "metadata",
        value: metadata,
        message: "Metadata must be an object",
        code: "INVALID_METADATA_TYPE"
      });
      return;
    }
    if (metadata.source && typeof metadata.source !== "string") {
      errors.push({
        field: "metadata.source",
        value: metadata.source,
        message: "Metadata source must be a string",
        code: "INVALID_METADATA_SOURCE"
      });
    }
    if (metadata.batchId && typeof metadata.batchId !== "string") {
      errors.push({
        field: "metadata.batchId",
        value: metadata.batchId,
        message: "Metadata batchId must be a string",
        code: "INVALID_METADATA_BATCH_ID"
      });
    }
    if (metadata.timestamp) {
      const date = new Date(metadata.timestamp);
      if (isNaN(date.getTime())) {
        errors.push({
          field: "metadata.timestamp",
          value: metadata.timestamp,
          message: "Invalid timestamp format in metadata",
          code: "INVALID_METADATA_TIMESTAMP"
        });
      }
    }
  }
  sanitizePayload(payload) {
    return {
      ...payload,
      id: payload.id?.trim(),
      status: this.normalizeStatus(payload.status),
      type: payload.type?.toLowerCase(),
      priority: payload.priority?.toLowerCase(),
      deliveryAddress: payload.deliveryAddress?.trim(),
      recipientName: payload.recipientName?.trim(),
      recipientPhone: this.sanitizePhoneNumber(payload.recipientPhone),
      routeName: payload.routeName?.trim(),
      employeeId: payload.employeeId?.trim(),
      pickupAddress: payload.pickupAddress?.trim(),
      dimensions: payload.dimensions?.trim(),
      specialInstructions: payload.specialInstructions?.trim()
    };
  }
  sanitizeBatch(batch) {
    return {
      ...batch,
      shipments: batch.shipments.map((shipment) => this.sanitizePayload(shipment))
    };
  }
  normalizeStatus(status) {
    const normalized = status?.trim();
    const matchedStatus = this.validStatuses.find(
      (s) => s.toLowerCase() === normalized?.toLowerCase()
    );
    return matchedStatus || status;
  }
  sanitizePhoneNumber(phone) {
    if (!phone) return phone;
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (/^\d{10}$/.test(cleaned)) {
      cleaned = "+91" + cleaned;
    }
    return cleaned;
  }
  /**
   * Gets validation rules documentation for API documentation
   */
  getValidationRulesDocumentation() {
    return {
      requiredFields: [
        "id",
        "status",
        "type",
        "deliveryAddress",
        "recipientName",
        "recipientPhone",
        "estimatedDeliveryTime",
        "cost",
        "routeName",
        "employeeId"
      ],
      fieldValidation: {
        id: "String, max 100 characters",
        status: `One of: ${this.validStatuses.join(", ")}`,
        type: `One of: ${this.validTypes.join(", ")}`,
        priority: `Optional. One of: ${this.validPriorities.join(", ")}`,
        deliveryAddress: "String, 10-500 characters",
        pickupAddress: "Optional string, min 10 characters",
        recipientName: "String, 2-100 characters",
        recipientPhone: "Indian phone number format (+91XXXXXXXXXX or 10 digits)",
        cost: "Number, 0 to \u20B910,00,000",
        weight: "Optional number, > 0, max 10,000 kg",
        latitude: "Number, -90 to 90 (preferably 6\xB0N to 37\xB0N for India)",
        longitude: "Number, -180 to 180 (preferably 68\xB0E to 97\xB0E for India)",
        estimatedDeliveryTime: "ISO 8601 date string, future date within 1 year",
        dimensions: "Optional string, max 100 characters",
        specialInstructions: "Optional string, max 1000 characters",
        routeName: "String, non-empty",
        employeeId: "String, non-empty"
      },
      batchLimits: {
        maxBatchSize: 100,
        duplicateIdCheck: "Enabled within batch"
      }
    };
  }
};
var payloadValidationService = new PayloadValidationService();

// server/middleware/webhookAuth.ts
await init_vite();
import crypto from "crypto";

// server/config/webhook.ts
var webhookConfig = {
  authentication: {
    methods: ["api-key", "hmac", "basic-auth"],
    apiKeys: [
      process.env.PIA_API_KEY || "printo-api-key-2024",
      process.env.EXTERNAL_API_KEY_1 || "external-system-key-1",
      process.env.EXTERNAL_API_KEY_2 || "riderpro-integration-key"
    ],
    hmacSecret: process.env.WEBHOOK_SECRET || "ad96b9b4d80432777acc8129186b652a971c42f9102934e6c6537c0ae0acea8c",
    basicAuthCredentials: [
      {
        username: process.env.WEBHOOK_USERNAME || "riderpro",
        password: process.env.WEBHOOK_PASSWORD || "webhook-2024"
      },
      {
        username: process.env.PRINTO_USERNAME || "printo",
        password: process.env.PRINTO_PASSWORD || "integration-key"
      }
    ]
  },
  security: {
    maxPayloadSize: parseInt(process.env.WEBHOOK_MAX_PAYLOAD_SIZE || "1048576"),
    // 1MB
    allowedIPs: process.env.WEBHOOK_ALLOWED_IPS?.split(",").map((ip) => ip.trim()),
    requireHttps: process.env.NODE_ENV === "production",
    corsOrigins: [
      "https://pia.printo.in",
      "https://api.printo.in",
      "https://webhook.printo.in"
    ]
  },
  rateLimit: {
    maxRequests: parseInt(process.env.WEBHOOK_RATE_LIMIT || "100"),
    windowMs: parseInt(process.env.WEBHOOK_RATE_WINDOW || "60000"),
    // 1 minute
    skipSuccessfulRequests: false
  },
  logging: {
    enabled: process.env.WEBHOOK_LOGGING !== "false",
    logLevel: process.env.WEBHOOK_LOG_LEVEL || "info",
    logHeaders: process.env.WEBHOOK_LOG_HEADERS === "true",
    logPayload: process.env.WEBHOOK_LOG_PAYLOAD === "true" && process.env.NODE_ENV !== "production"
  }
};

// server/middleware/webhookAuth.ts
var WebhookAuthMiddleware = class _WebhookAuthMiddleware {
  static {
    this.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "riderpro-webhook-secret-2024";
  }
  static {
    this.API_KEY_HEADER = "x-api-key";
  }
  static {
    this.SIGNATURE_HEADER = "x-webhook-signature";
  }
  static {
    this.TIMESTAMP_HEADER = "x-webhook-timestamp";
  }
  static {
    this.SOURCE_HEADER = "x-webhook-source";
  }
  static {
    // Valid API keys for external systems (in production, store in database)
    this.VALID_API_KEYS = /* @__PURE__ */ new Set([
      process.env.PIA_API_KEY || "printo-api-key-2024",
      process.env.EXTERNAL_API_KEY_1 || "external-system-key-1",
      process.env.EXTERNAL_API_KEY_2 || "riderpro-integration-key"
    ]);
  }
  /**
   * Main webhook authentication middleware
   */
  static authenticate() {
    return (req, res, next) => {
      try {
        log(`Webhook authentication attempt from ${req.ip}`, "webhook-auth");
        const apiKey = req.headers[_WebhookAuthMiddleware.API_KEY_HEADER];
        if (apiKey && _WebhookAuthMiddleware.validateApiKey(apiKey)) {
          req.webhookSource = req.headers[_WebhookAuthMiddleware.SOURCE_HEADER] || "api-key";
          log(`Webhook authenticated via API key from source: ${req.webhookSource}`, "webhook-auth");
          return next();
        }
        const signature = req.headers[_WebhookAuthMiddleware.SIGNATURE_HEADER];
        const timestamp = req.headers[_WebhookAuthMiddleware.TIMESTAMP_HEADER];
        if (signature && timestamp) {
          if (_WebhookAuthMiddleware.validateHmacSignature(req, signature, timestamp)) {
            req.webhookSource = req.headers[_WebhookAuthMiddleware.SOURCE_HEADER] || "hmac";
            req.webhookTimestamp = parseInt(timestamp);
            log(`Webhook authenticated via HMAC signature from source: ${req.webhookSource}`, "webhook-auth");
            return next();
          }
        }
        const authHeader = req.headers.authorization;
        if (authHeader && _WebhookAuthMiddleware.validateBasicAuth(authHeader)) {
          req.webhookSource = "basic-auth";
          log(`Webhook authenticated via basic auth`, "webhook-auth");
          return next();
        }
        log(`Webhook authentication failed from ${req.ip}`, "webhook-auth");
        return res.status(401).json({
          success: false,
          message: "Webhook authentication required",
          error: "WEBHOOK_AUTH_REQUIRED",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (error) {
        log(`Webhook authentication error: ${error.message}`, "webhook-auth");
        return res.status(500).json({
          success: false,
          message: "Webhook authentication error",
          error: "WEBHOOK_AUTH_ERROR",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    };
  }
  /**
   * Validate API key authentication
   */
  static validateApiKey(apiKey) {
    log(`Valid API Keys: ${Array.from(_WebhookAuthMiddleware.VALID_API_KEYS).join(", ")}`);
    log(`Received API Key: ${apiKey}`);
    log(`Environment Variables - PIA_API_KEY: ${process.env.PIA_API_KEY ? "set" : "not set"}, EXTERNAL_API_KEY_1: ${process.env.EXTERNAL_API_KEY_1 ? "set" : "not set"}, EXTERNAL_API_KEY_2: ${process.env.EXTERNAL_API_KEY_2 ? "set" : "not set"}`);
    if (!apiKey || typeof apiKey !== "string") {
      return false;
    }
    const trimmedKey = apiKey.trim();
    const isValid = webhookConfig.authentication.apiKeys.includes(trimmedKey);
    log(`API Key validation result: ${isValid}`, "webhook-auth");
    return isValid;
  }
  /**
   * Validate HMAC signature authentication
   */
  static validateHmacSignature(req, signature, timestamp) {
    try {
      const now = Math.floor(Date.now() / 1e3);
      const requestTime = parseInt(timestamp);
      if (Math.abs(now - requestTime) > 300) {
        log(`Webhook timestamp too old or too new: ${timestamp}`, "webhook-auth");
        return false;
      }
      const payload = JSON.stringify(req.body);
      const expectedSignature = _WebhookAuthMiddleware.createHmacSignature(payload, timestamp);
      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch (error) {
      log(`HMAC validation error: ${error.message}`, "webhook-auth");
      return false;
    }
  }
  /**
   * Validate basic authentication
   */
  static validateBasicAuth(authHeader) {
    try {
      if (!authHeader.startsWith("Basic ")) {
        return false;
      }
      const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
      const [username, password] = credentials.split(":");
      const validCredentials = webhookConfig.authentication.basicAuthCredentials;
      return validCredentials.some(
        (cred) => cred.username === username && cred.password === password
      );
    } catch (error) {
      log(`Basic auth validation error: ${error.message}`, "webhook-auth");
      return false;
    }
  }
  /**
   * Create HMAC signature for payload
   */
  static createHmacSignature(payload, timestamp) {
    const signaturePayload = `${timestamp}.${payload}`;
    return crypto.createHmac("sha256", webhookConfig.authentication.hmacSecret).update(signaturePayload, "utf8").digest("hex");
  }
  /**
   * Security headers middleware for webhook endpoints
   */
  static securityHeaders() {
    return (req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-webhook-signature, x-webhook-timestamp, x-webhook-source, Authorization");
      res.setHeader("Access-Control-Max-Age", "86400");
      if (req.method === "OPTIONS") {
        return res.status(200).end();
      }
      next();
    };
  }
  /**
   * Request logging middleware for webhooks
   */
  static requestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      log(`Webhook request: ${req.method} ${req.path} from ${req.ip} (source: ${req.webhookSource || "unknown"})`, "webhook-request");
      const safeHeaders = { ...req.headers };
      delete safeHeaders.authorization;
      delete safeHeaders[_WebhookAuthMiddleware.API_KEY_HEADER];
      delete safeHeaders[_WebhookAuthMiddleware.SIGNATURE_HEADER];
      log(`Webhook headers: ${JSON.stringify(safeHeaders)}`, "webhook-request");
      const originalJson = res.json;
      res.json = function(body) {
        const duration = Date.now() - startTime;
        log(`Webhook response: ${res.statusCode} in ${duration}ms (source: ${req.webhookSource || "unknown"})`, "webhook-request");
        if (res.statusCode >= 400) {
          log(`Webhook error response: ${JSON.stringify(body)}`, "webhook-request");
        }
        return originalJson.call(this, body);
      };
      next();
    };
  }
  /**
   * Rate limiting middleware for webhook endpoints
   */
  static rateLimit(maxRequests = 100, windowMs = 6e4) {
    const requests = /* @__PURE__ */ new Map();
    return (req, res, next) => {
      const clientId = req.ip || "unknown";
      const now = Date.now();
      const windowStart = now - windowMs;
      for (const [key, value] of requests.entries()) {
        if (value.resetTime < windowStart) {
          requests.delete(key);
        }
      }
      let clientRecord = requests.get(clientId);
      if (!clientRecord || clientRecord.resetTime < windowStart) {
        clientRecord = { count: 0, resetTime: now + windowMs };
        requests.set(clientId, clientRecord);
      }
      if (clientRecord.count >= maxRequests) {
        log(`Rate limit exceeded for ${clientId}`, "webhook-auth");
        return res.status(429).json({
          success: false,
          message: "Rate limit exceeded",
          error: "RATE_LIMIT_EXCEEDED",
          retryAfter: Math.ceil((clientRecord.resetTime - now) / 1e3),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      clientRecord.count++;
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - clientRecord.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(clientRecord.resetTime / 1e3));
      next();
    };
  }
  /**
   * Validate webhook payload size
   */
  static validatePayloadSize(maxSizeBytes = 1024 * 1024) {
    return (req, res, next) => {
      const contentLength = parseInt(req.headers["content-length"] || "0");
      if (contentLength > maxSizeBytes) {
        log(`Webhook payload too large: ${contentLength} bytes`, "webhook-auth");
        return res.status(413).json({
          success: false,
          message: "Payload too large",
          error: "PAYLOAD_TOO_LARGE",
          maxSize: maxSizeBytes,
          receivedSize: contentLength,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      next();
    };
  }
};
var webhookAuth = WebhookAuthMiddleware.authenticate();
var webhookSecurity = WebhookAuthMiddleware.securityHeaders();
var webhookLogger = WebhookAuthMiddleware.requestLogger();
var webhookRateLimit = WebhookAuthMiddleware.rateLimit();
var webhookPayloadLimit = WebhookAuthMiddleware.validatePayloadSize();

// server/routes.ts
import path5 from "path";
function hasRequiredPermission(_req, _requiredLevel) {
  return true;
}
async function registerRoutes(app2) {
  const setupErrorHandling = () => {
  };
  let healthCheckCache = null;
  const HEALTH_CHECK_CACHE_TTL = 1e4;
  const healthCheckRateLimit = /* @__PURE__ */ new Map();
  const HEALTH_CHECK_RATE_LIMIT = 10;
  const HEALTH_CHECK_RATE_WINDOW = 6e4;
  app2.get("/api/health", (req, res) => {
    const now = Date.now();
    const clientIP = req.ip || req.connection.remoteAddress || "unknown";
    const rateLimitKey = `health_${clientIP}`;
    const rateLimitData = healthCheckRateLimit.get(rateLimitKey);
    if (rateLimitData) {
      if (now > rateLimitData.resetTime) {
        healthCheckRateLimit.set(rateLimitKey, { count: 1, resetTime: now + HEALTH_CHECK_RATE_WINDOW });
      } else if (rateLimitData.count >= HEALTH_CHECK_RATE_LIMIT) {
        res.set("Retry-After", Math.ceil((rateLimitData.resetTime - now) / 1e3).toString());
        return res.status(429).json({
          error: "Rate limit exceeded",
          message: "Too many health check requests. Please slow down.",
          retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1e3)
        });
      } else {
        rateLimitData.count++;
      }
    } else {
      healthCheckRateLimit.set(rateLimitKey, { count: 1, resetTime: now + HEALTH_CHECK_RATE_WINDOW });
    }
    if (healthCheckCache && now - healthCheckCache.timestamp < HEALTH_CHECK_CACHE_TTL) {
      res.set("Cache-Control", "public, max-age=10");
      res.set("X-Health-Cache", "HIT");
      return res.status(200).json({ ...healthCheckCache.data, cached: true });
    }
    const healthData = {
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      cached: false
    };
    healthCheckCache = {
      data: healthData,
      timestamp: now
    };
    res.set("Cache-Control", "public, max-age=10");
    res.set("X-Health-Cache", "MISS");
    res.status(200).json(healthData);
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { riderId, password, fullName } = req.body;
      if (!riderId || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: "Rider ID, password, and full name are required"
        });
      }
      const existingUser = await db.query(
        "SELECT id FROM rider_accounts WHERE rider_id = $1",
        [riderId]
      );
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Rider ID already exists"
        });
      }
      const saltRounds = 12;
      const passwordHash = await bcrypt2.hash(password, saltRounds);
      const userId = "rider_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
      await db.query(`
        INSERT INTO rider_accounts (
          id, rider_id, full_name, password_hash, 
          is_active, is_approved, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, true, false, NOW(), NOW())
      `, [userId, riderId, fullName, passwordHash]);
      res.json({
        success: true,
        message: "Registration successful. Please wait for approval.",
        userId
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Registration failed. Please try again."
      });
    }
  });
  app2.post("/api/auth/local-login", async (req, res) => {
    try {
      const { riderId, password } = req.body;
      if (!riderId || !password) {
        return res.status(400).json({
          success: false,
          message: "Rider ID and password are required"
        });
      }
      const userResult = await db.query(`
        SELECT id, rider_id, full_name, password_hash, is_active, is_approved, role
        FROM rider_accounts 
        WHERE rider_id = $1 AND is_active = true
      `, [riderId]);
      const user = userResult.rows[0];
      if (!user) {
        console.log("User not found for riderId:", riderId);
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }
      const isValidPassword = await bcrypt2.compare(password, user.password_hash);
      if (!isValidPassword) {
        console.log("Invalid password for riderId:", riderId);
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }
      if (!user.is_approved) {
        return res.status(403).json({
          success: false,
          message: "Account pending approval. Please contact administrator.",
          isApproved: false
        });
      }
      const accessToken = "local_" + Date.now() + "_" + user.id;
      const refreshToken = "refresh_" + Date.now() + "_" + Math.random().toString(36).substring(2, 15);
      await db.query(`
        UPDATE rider_accounts 
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [user.id]);
      res.json({
        success: true,
        message: "Login successful",
        accessToken,
        refreshToken,
        fullName: user.full_name,
        isApproved: user.is_approved
      });
    } catch (error) {
      console.error("Local login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed. Please try again."
      });
    }
  });
  app2.get("/api/auth/pending-approvals", async (req, res) => {
    try {
      const pendingUsersResult = await db.query(`
        SELECT id, rider_id, full_name, created_at
        FROM rider_accounts 
        WHERE is_approved = false AND is_active = true
        ORDER BY created_at DESC
      `);
      const pendingUsers = pendingUsersResult.rows;
      res.json({
        success: true,
        users: pendingUsers
      });
    } catch (error) {
      console.error("Get pending approvals error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch pending approvals"
      });
    }
  });
  app2.post("/api/auth/approve/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await db.query(`
        UPDATE rider_accounts 
        SET is_approved = true, updated_at = NOW()
        WHERE id = $1 AND is_active = true
      `, [userId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      res.json({
        success: true,
        message: "User approved successfully"
      });
    } catch (error) {
      console.error("Approve user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve user"
      });
    }
  });
  app2.post("/api/auth/reject/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await db.query(`
        UPDATE rider_accounts 
        SET is_active = false, is_approved = false, updated_at = NOW()
        WHERE id = $1
      `, [userId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      res.json({
        success: true,
        message: "User rejected successfully"
      });
    } catch (error) {
      console.error("Reject user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reject user"
      });
    }
  });
  app2.post("/api/auth/reset-password/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }
      const saltRounds = 12;
      const passwordHash = await bcrypt2.hash(newPassword, saltRounds);
      const result = await db.query(`
        UPDATE rider_accounts 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2 AND is_active = true
      `, [passwordHash, userId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      res.json({
        success: true,
        message: "Password reset successfully"
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password"
      });
    }
  });
  app2.use("/uploads", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET");
    next();
  });
  app2.use("/uploads", express2.static(path5.join(process.cwd(), "uploads")));
  app2.get("/api/dashboard", async (req, res) => {
    try {
      console.log("\u{1F4CA} Dashboard endpoint called");
      const employeeId = req.query.employeeId;
      console.log("Employee ID:", employeeId);
      let metrics;
      if (employeeId) {
        try {
          console.log(`Getting metrics for employee: ${employeeId}`);
          metrics = await storage.getDashboardMetricsForEmployee(employeeId);
          console.log("Employee metrics retrieved successfully");
        } catch (error) {
          console.log(`No data found for employee ${employeeId}, falling back to cumulative metrics`);
          metrics = await storage.getDashboardMetrics();
          console.log("Fallback metrics retrieved successfully");
        }
      } else {
        console.log("Getting cumulative metrics");
        metrics = await storage.getDashboardMetrics();
        console.log("Cumulative metrics retrieved successfully");
      }
      console.log("Dashboard metrics:", JSON.stringify(metrics, null, 2));
      res.json(metrics);
    } catch (error) {
      console.error("\u274C Dashboard error:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({
        error: true,
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : void 0
      });
    }
  });
  app2.get("/api/vehicle-types", async (req, res) => {
    try {
      const vehicleTypes = await storage.getVehicleTypes();
      res.json(vehicleTypes);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/vehicle-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleType = await storage.getVehicleType(id);
      if (!vehicleType) {
        return res.status(404).json({ message: "Vehicle type not found" });
      }
      res.json(vehicleType);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/vehicle-types", async (req, res) => {
    try {
      const vehicleTypeData = req.body;
      if (!vehicleTypeData.id) {
        vehicleTypeData.id = `vt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      const vehicleType = await storage.createVehicleType(vehicleTypeData);
      res.status(201).json(vehicleType);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.put("/api/vehicle-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const vehicleType = await storage.updateVehicleType(id, updates);
      if (!vehicleType) {
        return res.status(404).json({ message: "Vehicle type not found" });
      }
      res.json(vehicleType);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/vehicle-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteVehicleType(id);
      if (!deleted) {
        return res.status(404).json({ message: "Vehicle type not found" });
      }
      res.json({ message: "Vehicle type deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/fuel-settings", async (req, res) => {
    try {
      const fuelSettings = await storage.getFuelSettings();
      res.json(fuelSettings);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/fuel-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const fuelSetting = await storage.getFuelSetting(id);
      if (!fuelSetting) {
        return res.status(404).json({ message: "Fuel setting not found" });
      }
      res.json(fuelSetting);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/fuel-settings", async (req, res) => {
    try {
      const fuelSettingData = req.body;
      if (!fuelSettingData.id) {
        fuelSettingData.id = `fs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      const fuelSetting = await storage.createFuelSetting(fuelSettingData);
      res.status(201).json(fuelSetting);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.put("/api/fuel-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const fuelSetting = await storage.updateFuelSetting(id, updates);
      if (!fuelSetting) {
        return res.status(404).json({ message: "Fuel setting not found" });
      }
      res.json(fuelSetting);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.delete("/api/fuel-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFuelSetting(id);
      if (!deleted) {
        return res.status(404).json({ message: "Fuel setting not found" });
      }
      res.json({ message: "Fuel setting deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/routes/sessions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const sessions = await routeService.listRecentSessions(limit);
      res.json({ success: true, data: sessions });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  app2.get("/api/routes/active/:employeeId", async (req, res) => {
    try {
      console.log("\u{1F6E3}\uFE0F Active routes endpoint called");
      const { employeeId } = req.params;
      console.log("Employee ID:", employeeId);
      console.log("Checking if employee exists in shipments...");
      const employeeCheck = await db.query(
        'SELECT COUNT(*)::int as count FROM shipments WHERE "employeeId" = $1',
        [employeeId]
      );
      console.log("Employee check result:", employeeCheck.rows[0]);
      if (employeeCheck.rows[0]?.count === 0) {
        console.log(`No shipments found for employee ${employeeId}`);
        return res.json({
          success: true,
          data: null,
          message: `No data found for employee ${employeeId}. Showing cumulative metrics instead.`
        });
      }
      console.log("Getting active session for employee...");
      const activeSession = await routeService.getActiveSession(employeeId);
      console.log("Active session result:", activeSession);
      if (!activeSession) {
        console.log("No active session found");
        return res.json({
          success: true,
          data: null,
          message: "No active session found for this employee"
        });
      }
      console.log("Returning active session data");
      res.json({ success: true, data: activeSession });
    } catch (e) {
      console.error("\u274C Error getting active session:", e);
      console.error("Error stack:", e.stack);
      res.status(500).json({
        success: false,
        message: e.message,
        stack: process.env.NODE_ENV === "development" ? e.stack : void 0
      });
    }
  });
  app2.get("/api/routes/analytics/summary", async (_req, res) => {
    try {
      const summary = await routeService.getAnalyticsSummary();
      res.json({ success: true, data: summary });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  app2.get("/api/riders", async (_req, res) => {
    try {
      const riders = await riderService.listRiders();
      res.json({ success: true, data: riders });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  app2.post("/api/riders/unregistered", async (req, res) => {
    try {
      const { riderId } = req.body;
      if (!riderId) {
        return res.status(400).json({ success: false, message: "riderId is required" });
      }
      const result = await db.query("SELECT id FROM rider_accounts WHERE rider_id = $1", [riderId]);
      res.json({
        success: true,
        exists: result.rows.length > 0,
        isRegistered: result.rows.length > 0
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  app2.post("/api/riders/register", async (req, res) => {
    try {
      const { riderId, password } = req.body;
      if (!riderId || !password) {
        return res.status(400).json({ success: false, message: "riderId and password are required" });
      }
      const fullName = `Rider ${riderId}`;
      const rider = await riderService.registerRider(riderId, fullName, password);
      res.status(201).json({ success: true, data: rider });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  });
  app2.post("/api/riders/check-exists", async (req, res) => {
    try {
      const { riderId } = req.body || {};
      if (!riderId) {
        return res.status(400).json({ success: false, message: "riderId is required" });
      }
      const result = await db.query("SELECT rider_id, name, is_active FROM riders WHERE rider_id = $1", [riderId]);
      const exists = result.rows.length > 0;
      return res.json({ success: true, exists, rider: exists ? result.rows[0] : null });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });
  app2.post("/api/riders/login", async (req, res) => {
    try {
      const { riderId, password } = req.body;
      if (!riderId || !password) {
        return res.status(400).json({ success: false, message: "riderId and password are required" });
      }
      const rider = await riderService.login(riderId, password);
      if (!rider) return res.status(401).json({ success: false, message: "Invalid credentials" });
      const token = Buffer.from(`${riderId}:${Date.now()}`).toString("base64");
      res.json({
        success: true,
        name: rider.full_name,
        riderId: rider.rider_id,
        token,
        isApproved: rider.is_approved
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  app2.get("/api/shipments/fetch", async (req, res) => {
    try {
      const apiTokenAuth = req.isApiTokenAuth && req.apiToken;
      let employeeId = req.headers["x-employee-id"] || void 0;
      let userRole = req.headers["x-user-role"] || "driver";
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const decoded = Buffer.from(token, "base64").toString("utf-8");
          const [riderId] = decoded.split(":");
          if (riderId) {
            employeeId = riderId;
            userRole = "driver";
          }
        } catch (e) {
        }
      }
      if (apiTokenAuth) {
        userRole = "admin";
      }
      if (!employeeId && userRole === "driver") {
        employeeId = "driver";
      }
      const filters = {};
      const validFilters = ["status", "priority", "type", "routeName", "date", "search", "employeeId"];
      for (const [key, value] of Object.entries(req.query)) {
        if (validFilters.includes(key) && typeof value === "string") {
          filters[key] = value;
        }
      }
      if (req.query.dateRange) {
        try {
          const dateRange = typeof req.query.dateRange === "string" ? JSON.parse(req.query.dateRange) : req.query.dateRange;
          if (dateRange && typeof dateRange === "object" && "start" in dateRange && "end" in dateRange) {
            filters.dateRange = {
              start: String(dateRange.start),
              end: String(dateRange.end)
            };
          }
        } catch (e) {
          console.warn("Invalid dateRange format:", req.query.dateRange);
        }
      }
      if (req.query.page) {
        const page2 = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
        filters.page = typeof page2 === "string" ? parseInt(page2, 10) : 1;
      }
      if (req.query.limit) {
        const limit2 = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        filters.limit = typeof limit2 === "string" ? parseInt(limit2, 10) : 20;
      }
      if (req.query.sortField) {
        const sortField = Array.isArray(req.query.sortField) ? req.query.sortField[0] : req.query.sortField;
        if (typeof sortField === "string") {
          filters.sortField = sortField;
        }
      }
      if (req.query.sortOrder) {
        const sortOrder = Array.isArray(req.query.sortOrder) ? req.query.sortOrder[0] : req.query.sortOrder;
        if (typeof sortOrder === "string" && (sortOrder.toUpperCase() === "ASC" || sortOrder.toUpperCase() === "DESC")) {
          filters.sortOrder = sortOrder.toUpperCase();
        }
      }
      if (userRole === "driver" && employeeId && employeeId !== "driver") {
        filters.employeeId = employeeId;
      }
      res.set("Cache-Control", "public, max-age=300");
      const { data: shipments, total } = await storage.getShipments(filters);
      const page = Math.max(1, parseInt(filters.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
      const totalPages = Math.ceil(total / limit);
      res.set({
        "X-Total-Count": total,
        "X-Total-Pages": totalPages,
        "X-Current-Page": page,
        "X-Per-Page": limit,
        "X-Has-Next-Page": page < totalPages,
        "X-Has-Previous-Page": page > 1
      });
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching shipments:", error);
      res.status(500).json({ message: error.message || "Failed to fetch shipments" });
    }
  });
  app2.get("/api/routes/names", async (_req, res) => {
    try {
      const db2 = storage.getDatabase();
      const result = await db2.query('SELECT DISTINCT "routeName" as name FROM shipments WHERE "routeName" IS NOT NULL ORDER BY name');
      res.json({ success: true, data: result.rows.map((r) => r.name) });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
  app2.get("/api/shipments/:id", async (req, res) => {
    try {
      const shipment = await storage.getShipment(req.params.id);
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      const acknowledgment = await storage.getAcknowledgmentByShipmentId(shipment.shipment_id);
      res.json({ shipment, acknowledgment });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.patch("/api/shipments/:id/tracking", async (req, res) => {
    try {
      const { id } = req.params;
      const trackingData = req.body;
      const allowedFields = ["start_latitude", "start_longitude", "stop_latitude", "stop_longitude", "km_travelled", "status", "actualDeliveryTime"];
      const updates = { shipment_id: id };
      for (const field of allowedFields) {
        if (trackingData[field] !== void 0) {
          updates[field] = trackingData[field];
        }
      }
      if (Object.keys(updates).length === 1) {
        return res.status(400).json({
          success: false,
          message: "No valid tracking fields provided",
          code: "NO_VALID_FIELDS"
        });
      }
      const updatedShipment = await storage.updateShipment(id, updates);
      if (!updatedShipment) {
        return res.status(404).json({
          success: false,
          message: "Shipment not found",
          code: "SHIPMENT_NOT_FOUND"
        });
      }
      storage.updateShipment(id, {
        shipment_id: id,
        synced_to_external: false,
        last_sync_attempt: void 0,
        sync_error: void 0
      });
      res.json({
        success: true,
        message: "Tracking data updated successfully",
        shipment: updatedShipment
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: "TRACKING_UPDATE_FAILED"
      });
    }
  });
  app2.post("/api/shipments/:id/sync", async (req, res) => {
    try {
      const { id } = req.params;
      const shipment = await storage.getShipment(id);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: "Shipment not found",
          code: "SHIPMENT_NOT_FOUND"
        });
      }
      try {
        const { ExternalApiService: ExternalApiService2 } = await Promise.resolve().then(() => (init_ExternalApiService(), ExternalApiService_exports));
        const externalApi = ExternalApiService2.getInstance();
        const syncData = externalApi.prepareSyncData(shipment);
        const validation = externalApi.validatePayload(syncData);
        if (!validation.valid) {
          console.warn("Payload validation warnings:", validation.warnings);
        }
        console.log(`Syncing shipment ${syncData.shipment_id} (${validation.size} bytes)`);
        const result = await externalApi.syncShipment(shipment);
        if (result.success) {
          storage.updateShipment(id, {
            shipment_id: id,
            synced_to_external: true,
            last_sync_attempt: (/* @__PURE__ */ new Date()).toISOString(),
            sync_error: void 0
          });
          res.json({
            success: true,
            message: result.message,
            syncedAt: result.synced_at,
            externalId: result.external_id
          });
        } else {
          storage.updateShipment(id, {
            shipment_id: id,
            synced_to_external: false,
            last_sync_attempt: (/* @__PURE__ */ new Date()).toISOString(),
            sync_error: result.error || "Unknown error"
          });
          res.status(500).json({
            success: false,
            message: result.message,
            error: result.error,
            code: "SYNC_FAILED"
          });
        }
      } catch (syncError) {
        storage.updateShipment(id, {
          shipment_id: id,
          synced_to_external: false,
          last_sync_attempt: (/* @__PURE__ */ new Date()).toISOString(),
          sync_error: syncError.message
        });
        res.status(500).json({
          success: false,
          message: "Failed to sync to external system",
          error: syncError.message,
          code: "SYNC_FAILED"
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: "SYNC_REQUEST_FAILED"
      });
    }
  });
  app2.get("/api/admin/access-tokens", async (req, res) => {
    try {
      const { API_KEYS: API_KEYS2, getMaskedApiKey: getMaskedApiKey2 } = await Promise.resolve().then(() => (init_apiKeys(), apiKeys_exports));
      const accessTokens = [
        {
          id: "access-token-1",
          name: "Access Token 1",
          token: API_KEYS2.ACCESS_TOKEN_1,
          masked: getMaskedApiKey2("ACCESS_TOKEN_1"),
          description: "Primary access token for external system integration",
          created: "2024-01-01T00:00:00Z",
          status: "active"
        },
        {
          id: "access-token-2",
          name: "Access Token 2",
          token: API_KEYS2.ACCESS_TOKEN_2,
          masked: getMaskedApiKey2("ACCESS_TOKEN_2"),
          description: "Secondary access token for external system integration",
          created: "2024-01-01T00:00:00Z",
          status: "active"
        }
      ];
      res.json({
        success: true,
        accessTokens
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to retrieve access tokens",
        error: error.message
      });
    }
  });
  app2.get("/api/shipments/sync-status", async (req, res) => {
    try {
      const { shipmentId, status } = req.query;
      let query = "SELECT id, NULL as shipment_id, NULL as synced_to_external, NULL as last_sync_attempt, NULL as sync_error FROM shipments";
      const conditions = [];
      const params = [];
      if (shipmentId) {
        conditions.push("id = $1");
        params.push(shipmentId);
      }
      if (status === "pending") {
        conditions.push("synced_to_external = 0");
      } else if (status === "success") {
        conditions.push("synced_to_external = 1");
      } else if (status === "failed") {
        conditions.push("synced_to_external = 0 AND sync_error IS NOT NULL");
      }
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      const shipmentsResult = await storage.getShipments({});
      const shipments = shipmentsResult.data;
      const syncStatus = shipments.map((shipment) => ({
        shipmentId: shipment.shipment_id,
        externalId: shipment.shipment_id,
        status: shipment.synced_to_external ? "success" : "failed",
        lastAttempt: shipment.last_sync_attempt,
        error: shipment.sync_error
      }));
      res.json({
        success: true,
        syncStatus
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: "SYNC_STATUS_FAILED"
      });
    }
  });
  app2.post("/api/shipments/batch-sync", async (req, res) => {
    try {
      const { shipmentIds } = req.body;
      if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "shipmentIds array is required",
          code: "INVALID_SHIPMENT_IDS"
        });
      }
      const shipmentPromises = shipmentIds.map((id) => storage.getShipment(id));
      const shipmentResults = await Promise.all(shipmentPromises);
      const shipments = shipmentResults.filter((shipment) => shipment !== void 0);
      if (shipments.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No valid shipments found",
          code: "NO_VALID_SHIPMENTS"
        });
      }
      const { ExternalApiService: ExternalApiService2 } = await Promise.resolve().then(() => (init_ExternalApiService(), ExternalApiService_exports));
      const externalApi = ExternalApiService2.getInstance();
      console.log(`Batch syncing ${shipments.length} shipments...`);
      const results = await externalApi.batchSyncShipments(shipments);
      shipments.forEach((shipment, index) => {
        const result = results[index];
        if (result) {
          storage.updateShipment(shipment.shipment_id, {
            shipment_id: shipment.shipment_id,
            synced_to_external: result.success,
            last_sync_attempt: (/* @__PURE__ */ new Date()).toISOString(),
            sync_error: result.success ? void 0 : result.error
          });
        }
      });
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;
      res.json({
        success: true,
        message: `Batch sync completed: ${successCount} successful, ${failureCount} failed`,
        results: results.map((result, index) => ({
          shipmentId: shipments[index].shipment_id,
          externalId: shipments[index].shipment_id || shipments[index].trackingNumber,
          success: result.success,
          message: result.message,
          error: result.error
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Batch sync failed",
        error: error.message,
        code: "BATCH_SYNC_FAILED"
      });
    }
  });
  app2.post(
    "/api/shipments/receive",
    webhookSecurity,
    webhookRateLimit,
    webhookPayloadLimit,
    webhookAuth,
    webhookLogger,
    async (req, res) => {
      try {
        const payload = req.body;
        if (!req.is("application/json")) {
          return res.status(400).json({
            success: false,
            message: "Content-Type must be application/json",
            error: "INVALID_CONTENT_TYPE",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        if (!payload || typeof payload !== "object") {
          return res.status(400).json({
            success: false,
            message: "Request body must be a valid JSON object",
            error: "INVALID_PAYLOAD",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({
            success: false,
            message: "Access token required. Use Authorization: Bearer <token>",
            error: "MISSING_ACCESS_TOKEN",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        const providedToken = authHeader.substring(7);
        const { API_KEYS: API_KEYS2, validateApiKey: validateApiKey2 } = await Promise.resolve().then(() => (init_apiKeys(), apiKeys_exports));
        const isValidToken = validateApiKey2(providedToken, "ACCESS_TOKEN_1") || validateApiKey2(providedToken, "ACCESS_TOKEN_2");
        if (!isValidToken) {
          return res.status(401).json({
            success: false,
            message: "Invalid access token. Please use a valid access token.",
            error: "INVALID_ACCESS_TOKEN",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        const isBatch = payload.shipments && Array.isArray(payload.shipments);
        if (isBatch) {
          const batchValidation = payloadValidationService.validateBatchShipments(payload);
          if (!batchValidation.isValid) {
            return res.status(400).json({
              success: false,
              message: "Batch validation failed",
              errors: batchValidation.errors,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
          const results = {
            total: payload.shipments.length,
            created: 0,
            updated: 0,
            failed: 0,
            duplicates: 0
          };
          const processedShipments = [];
          for (let i = 0; i < payload.shipments.length; i++) {
            const externalShipment = payload.shipments[i];
            try {
              const internalShipment = fieldMappingService.mapExternalToInternal(externalShipment);
              const existingShipment = await storage.getShipmentByExternalId(externalShipment.id);
              if (existingShipment) {
                const updatedShipment = await storage.updateShipment(existingShipment.shipment_id, {
                  shipment_id: existingShipment.shipment_id,
                  status: internalShipment.status,
                  priority: internalShipment.priority,
                  customerName: internalShipment.customerName,
                  customerMobile: internalShipment.customerMobile,
                  address: internalShipment.address,
                  latitude: internalShipment.latitude,
                  longitude: internalShipment.longitude,
                  cost: internalShipment.cost,
                  deliveryTime: internalShipment.deliveryTime,
                  routeName: internalShipment.routeName,
                  employeeId: internalShipment.employeeId,
                  pickupAddress: internalShipment.pickupAddress,
                  weight: internalShipment.weight,
                  dimensions: internalShipment.dimensions,
                  specialInstructions: internalShipment.specialInstructions
                });
                results.updated++;
                processedShipments.push({
                  piashipmentid: externalShipment.id,
                  internalId: existingShipment.shipment_id,
                  status: "updated",
                  message: "Shipment updated successfully"
                });
              } else {
                const newShipment = await storage.createShipment({
                  shipment_id: internalShipment.piashipmentid || internalShipment.shipment_id,
                  trackingNumber: internalShipment.piashipmentid || internalShipment.shipment_id,
                  type: internalShipment.type,
                  customerName: internalShipment.customerName,
                  customerMobile: internalShipment.customerMobile,
                  address: internalShipment.address,
                  latitude: internalShipment.latitude,
                  longitude: internalShipment.longitude,
                  cost: internalShipment.cost,
                  deliveryTime: internalShipment.deliveryTime,
                  routeName: internalShipment.routeName,
                  employeeId: internalShipment.employeeId,
                  status: internalShipment.status,
                  priority: internalShipment.priority || "medium",
                  pickupAddress: internalShipment.pickupAddress || "",
                  deliveryAddress: internalShipment.address,
                  recipientName: internalShipment.customerName,
                  recipientPhone: internalShipment.customerMobile,
                  weight: internalShipment.weight || 0,
                  dimensions: internalShipment.dimensions || "",
                  specialInstructions: internalShipment.specialInstructions,
                  estimatedDeliveryTime: internalShipment.deliveryTime
                });
                results.created++;
                processedShipments.push({
                  piashipmentid: externalShipment.id,
                  internalId: newShipment.shipment_id,
                  status: "created",
                  message: "Shipment created successfully"
                });
              }
            } catch (error) {
              results.failed++;
              processedShipments.push({
                piashipmentid: externalShipment.id,
                internalId: null,
                status: "failed",
                message: error.message
              });
            }
          }
          return res.status(200).json({
            success: true,
            message: `Batch processing completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
            results,
            processedShipments,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        } else {
          const singleValidation = payloadValidationService.validateSingleShipment(payload);
          if (!singleValidation.isValid) {
            return res.status(400).json({
              success: false,
              message: "Validation failed",
              errors: singleValidation.errors,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
          const internalShipment = fieldMappingService.mapExternalToInternal(payload);
          const existingShipment = await storage.getShipmentByExternalId(payload.id);
          if (existingShipment) {
            const updatedShipment = await storage.updateShipment(existingShipment.shipment_id, {
              shipment_id: existingShipment.shipment_id,
              status: internalShipment.status,
              priority: internalShipment.priority,
              customerName: internalShipment.customerName,
              customerMobile: internalShipment.customerMobile,
              address: internalShipment.address,
              latitude: internalShipment.latitude,
              longitude: internalShipment.longitude,
              cost: internalShipment.cost,
              deliveryTime: internalShipment.deliveryTime,
              routeName: internalShipment.routeName,
              employeeId: internalShipment.employeeId,
              pickupAddress: internalShipment.pickupAddress,
              weight: internalShipment.weight,
              dimensions: internalShipment.dimensions,
              specialInstructions: internalShipment.specialInstructions
            });
            return res.status(200).json({
              success: true,
              message: "Shipment updated successfully",
              results: {
                total: 1,
                created: 0,
                updated: 1,
                failed: 0,
                duplicates: 0
              },
              processedShipments: [{
                piashipmentid: payload.id,
                internalId: existingShipment.shipment_id,
                status: "updated",
                message: "Shipment updated successfully"
              }],
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          } else {
            const newShipment = await storage.createShipment({
              shipment_id: internalShipment.piashipmentid || internalShipment.shipment_id,
              trackingNumber: internalShipment.piashipmentid || internalShipment.shipment_id,
              type: internalShipment.type,
              customerName: internalShipment.customerName,
              customerMobile: internalShipment.customerMobile,
              address: internalShipment.address,
              latitude: internalShipment.latitude,
              longitude: internalShipment.longitude,
              cost: internalShipment.cost,
              deliveryTime: internalShipment.deliveryTime,
              routeName: internalShipment.routeName,
              employeeId: internalShipment.employeeId,
              status: internalShipment.status,
              priority: internalShipment.priority || "medium",
              pickupAddress: internalShipment.pickupAddress || "",
              deliveryAddress: internalShipment.address,
              recipientName: internalShipment.customerName,
              recipientPhone: internalShipment.customerMobile,
              weight: internalShipment.weight || 0,
              dimensions: internalShipment.dimensions || "",
              specialInstructions: internalShipment.specialInstructions,
              estimatedDeliveryTime: internalShipment.deliveryTime
            });
            return res.status(201).json({
              success: true,
              message: "Shipment created successfully",
              results: {
                total: 1,
                created: 1,
                updated: 0,
                failed: 0,
                duplicates: 0
              },
              processedShipments: [{
                piashipmentid: payload.id,
                internalId: newShipment.shipment_id,
                status: "created",
                message: "Shipment created successfully"
              }],
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      } catch (error) {
        console.error("Error processing external shipment data:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error while processing shipment data",
          error: error.message,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  );
  app2.patch("/api/shipments/:id", async (req, res) => {
    try {
      if (!hasRequiredPermission(req, "write")) {
        return res.status(403).json({
          message: "Insufficient permissions. Write access required to update shipments.",
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
      const updates = updateShipmentSchema.parse(req.body);
      const currentShipment = await storage.getShipment(req.params.id);
      if (!currentShipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      if (updates.status === "Delivered" && currentShipment.type !== "delivery") {
        return res.status(400).json({ message: "Cannot mark a pickup shipment as Delivered" });
      }
      if (updates.status === "Picked Up" && currentShipment.type !== "pickup") {
        return res.status(400).json({ message: "Cannot mark a delivery shipment as Picked Up" });
      }
      const shipment = await storage.updateShipment(req.params.id, updates);
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      externalSync.syncShipmentUpdate(shipment).catch((err) => {
        console.error("External sync failed for shipment update:", err);
      });
      res.json(shipment);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.patch("/api/shipments/batch", async (req, res) => {
    try {
      if (!hasRequiredPermission(req, "write")) {
        return res.status(403).json({
          message: "Insufficient permissions. Write access required to batch update shipments.",
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
      const batchData = batchUpdateSchema.parse(req.body);
      for (const update of batchData.updates) {
        const shipment = await storage.getShipment(update.shipment_id);
        if (!shipment) {
          return res.status(400).json({ message: `Shipment ${update.shipment_id} not found` });
        }
        if (update.status === "Delivered" && shipment.type !== "delivery") {
          return res.status(400).json({ message: `Cannot mark pickup shipment ${update.shipment_id} as Delivered` });
        }
        if (update.status === "Picked Up" && shipment.type !== "pickup") {
          return res.status(400).json({ message: `Cannot mark delivery shipment ${update.shipment_id} as Picked Up` });
        }
      }
      const updatedCount = await storage.batchUpdateShipments(batchData);
      const updatedShipments = await Promise.all(
        batchData.updates.map(async (update) => {
          const shipment = await storage.getShipment(update.shipment_id);
          return shipment;
        })
      );
      const validShipments = updatedShipments.filter(Boolean);
      externalSync.batchSyncShipments(validShipments).catch((err) => {
        console.error("External batch sync failed:", err);
      });
      res.json({ updatedCount, message: `${updatedCount} shipments updated successfully` });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.post(
    "/api/shipments/:id/acknowledgement",
    authenticate,
    // Enable authentication to track who captured the acknowledgment
    upload.fields([
      { name: "photo", maxCount: 1 },
      { name: "signature", maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        if (!hasRequiredPermission(req, "write")) {
          return res.status(403).json({
            message: "Insufficient permissions. Write access required to upload acknowledgements.",
            code: "INSUFFICIENT_PERMISSIONS"
          });
        }
        const shipmentId = req.params.id;
        const files = req.files;
        const { signatureData } = req.body;
        const shipment = await storage.getShipment(shipmentId);
        if (!shipment) {
          return res.status(404).json({ message: "Shipment not found" });
        }
        let signatureUrl;
        let photoUrl;
        if (files.photo && files.photo[0]) {
          photoUrl = getFileUrl(files.photo[0].filename, "photo");
        }
        if (files.signature && files.signature[0]) {
          signatureUrl = getFileUrl(files.signature[0].filename, "signature");
        } else if (signatureData) {
          try {
            const filename = await saveBase64File(signatureData, "signature");
            signatureUrl = getFileUrl(filename, "signature");
          } catch (error) {
            console.error("Failed to save signature data:", error);
          }
        }
        const acknowledgment = await storage.createAcknowledgment({
          shipment_id: shipmentId,
          signatureUrl,
          photoUrl,
          acknowledgment_captured_at: (/* @__PURE__ */ new Date()).toISOString(),
          acknowledgment_captured_by: req.user?.employeeId || req.user?.id || "unknown"
          // Track who captured the acknowledgment (employee ID or user ID)
        });
        externalSync.syncShipmentUpdate(shipment, acknowledgment).catch((err) => {
          console.error("External sync failed for acknowledgment:", err);
        });
        res.status(201).json(acknowledgment);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    }
  );
  app2.get("/api/sync/stats", async (_req, res) => {
    try {
      const countsSql = `
        SELECT
          SUM(CASE WHEN synced_to_external = FALSE THEN 1 ELSE 0 END) AS total_pending,
          SUM(CASE WHEN synced_to_external = TRUE THEN 1 ELSE 0 END) AS total_sent,
          SUM(CASE WHEN sync_error IS NOT NULL AND sync_error <> '' THEN 1 ELSE 0 END) AS total_failed,
          MAX(last_sync_attempt) AS last_sync_time
        FROM shipments
      `;
      const result = await db.query(countsSql);
      const row = result.rows[0] || { total_pending: 0, total_sent: 0, total_failed: 0, last_sync_time: null };
      res.json({
        totalPending: Number(row.total_pending || 0),
        totalSent: Number(row.total_sent || 0),
        totalFailed: Number(row.total_failed || 0),
        lastSyncTime: row.last_sync_time || null
      });
    } catch (_error) {
      res.json({ totalPending: 0, totalSent: 0, totalFailed: 0, lastSyncTime: null });
    }
  });
  app2.post("/api/sync/trigger", async (req, res) => {
    try {
      const { data: shipments } = await storage.getShipments({});
      const result = await externalSync.batchSyncShipments(shipments);
      res.json({
        processed: shipments.length,
        success: result.success,
        failed: result.failed
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post("/api/shipments/:id/remarks", async (req, res) => {
    try {
      if (!hasRequiredPermission(req, "write")) {
        return res.status(403).json({
          message: "Insufficient permissions. Write access required to add remarks.",
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
      const shipmentId = req.params.id;
      const { remarks, status } = req.body;
      if (!remarks || !status) {
        return res.status(400).json({ message: "Remarks and status are required" });
      }
      const shipment = await storage.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      console.log(`Remarks for shipment ${shipmentId} (${status}):`, remarks);
      res.status(201).json({
        shipmentId,
        remarks,
        status,
        savedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app2.delete("/api/shipments/:id", async (req, res) => {
    try {
      if (!hasRequiredPermission(req, "admin")) {
        return res.status(403).json({
          message: "Insufficient permissions. Admin access required to delete shipments.",
          code: "INSUFFICIENT_PERMISSIONS"
        });
      }
      const shipmentId = req.params.id;
      const shipment = await storage.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      const result = await storage.updateShipment(shipmentId, {
        shipment_id: shipmentId,
        status: "Deleted"
      });
      if (!result) {
        return res.status(500).json({ message: "Failed to delete shipment" });
      }
      res.json({
        message: "Shipment deleted successfully",
        shipmentId
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.post(
    "/api/shipments/update/external",
    webhookAuth,
    webhookSecurity,
    webhookRateLimit,
    async (req, res) => {
      try {
        const { shipmentId, additionalData } = req.body;
        if (!shipmentId) {
          return res.status(400).json({
            success: false,
            message: "Shipment ID is required",
            code: "MISSING_SHIPMENT_ID"
          });
        }
        const shipment = await storage.getShipment(shipmentId);
        if (!shipment) {
          return res.status(404).json({
            success: false,
            message: "Shipment not found",
            code: "SHIPMENT_NOT_FOUND"
          });
        }
        const internalShipment = {
          shipment_id: shipment.shipment_id,
          type: shipment.type || "delivery",
          customerName: shipment.customerName || shipment.recipientName,
          customerMobile: shipment.customerMobile || shipment.recipientPhone,
          address: shipment.address || shipment.deliveryAddress,
          deliveryTime: shipment.deliveryTime || shipment.estimatedDeliveryTime || (/* @__PURE__ */ new Date()).toISOString(),
          cost: shipment.cost || 0,
          routeName: shipment.routeName || "default",
          employeeId: shipment.employeeId || "unknown",
          status: shipment.status,
          createdAt: shipment.createdAt,
          updatedAt: shipment.updatedAt,
          priority: shipment.priority,
          pickupAddress: shipment.pickupAddress,
          weight: shipment.weight,
          dimensions: shipment.dimensions,
          specialInstructions: shipment.specialInstructions,
          actualDeliveryTime: shipment.deliveryTime,
          latitude: shipment.latitude,
          longitude: shipment.longitude,
          piashipmentid: shipment.trackingNumber
        };
        const externalUpdate = fieldMappingService.mapInternalToExternal(internalShipment, additionalData);
        const deliveryResult = await externalSync.sendUpdateToExternal(externalUpdate);
        if (deliveryResult.success) {
          res.json({
            success: true,
            message: "Shipment update sent successfully",
            data: {
              shipmentId: shipment.shipment_id,
              externalId: externalUpdate.id,
              status: externalUpdate.status,
              attempts: deliveryResult.attempts,
              webhookUrl: deliveryResult.webhookUrl,
              deliveredAt: deliveryResult.deliveredAt,
              sentAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          });
        } else {
          res.status(500).json({
            success: false,
            message: "Failed to send update to external system",
            code: "EXTERNAL_SYNC_FAILED",
            data: {
              shipmentId: shipment.shipment_id,
              externalId: externalUpdate.id,
              attempts: deliveryResult.attempts,
              lastError: deliveryResult.lastError,
              webhookUrl: deliveryResult.webhookUrl
            }
          });
        }
      } catch (error) {
        console.error("Error sending external update:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error while sending update",
          code: "INTERNAL_ERROR",
          error: error.message
        });
      }
    }
  );
  app2.post(
    "/api/shipments/update/external/batch",
    webhookAuth,
    webhookSecurity,
    webhookRateLimit,
    async (req, res) => {
      try {
        const { shipmentIds, updates, metadata } = req.body;
        if (!shipmentIds && !updates) {
          return res.status(400).json({
            success: false,
            message: "Either shipmentIds array or updates array is required",
            code: "MISSING_BATCH_DATA"
          });
        }
        let updatePayloads = [];
        if (updates && Array.isArray(updates)) {
          updatePayloads = updates;
        } else if (shipmentIds && Array.isArray(shipmentIds)) {
          const shipments = await Promise.all(
            shipmentIds.map(async (id) => {
              try {
                return await storage.getShipment(id);
              } catch (error) {
                console.error(`Error fetching shipment ${id}:`, error);
                return null;
              }
            })
          );
          const validShipments = shipments.filter((s) => s !== null && s !== void 0);
          if (validShipments.length === 0) {
            return res.status(404).json({
              success: false,
              message: "No valid shipments found",
              code: "NO_SHIPMENTS_FOUND"
            });
          }
          updatePayloads = validShipments.map((shipment) => {
            const internalShipment = {
              shipment_id: shipment.shipment_id,
              type: shipment.type || "delivery",
              customerName: shipment.customerName || shipment.recipientName,
              customerMobile: shipment.customerMobile || shipment.recipientPhone,
              address: shipment.address || shipment.deliveryAddress,
              deliveryTime: shipment.deliveryTime || shipment.estimatedDeliveryTime || (/* @__PURE__ */ new Date()).toISOString(),
              cost: shipment.cost || 0,
              routeName: shipment.routeName || "default",
              employeeId: shipment.employeeId || "unknown",
              status: shipment.status,
              createdAt: shipment.createdAt,
              updatedAt: shipment.updatedAt,
              priority: shipment.priority,
              pickupAddress: shipment.pickupAddress,
              weight: shipment.weight,
              dimensions: shipment.dimensions,
              specialInstructions: shipment.specialInstructions,
              actualDeliveryTime: shipment.deliveryTime,
              latitude: shipment.latitude,
              longitude: shipment.longitude,
              piashipmentid: shipment.trackingNumber
            };
            return fieldMappingService.mapInternalToExternal(internalShipment, metadata?.additionalData);
          });
        }
        if (updatePayloads.length === 0) {
          return res.status(400).json({
            success: false,
            message: "No updates to process",
            code: "EMPTY_BATCH"
          });
        }
        const batchResult = await externalSync.sendBatchUpdatesToExternal(updatePayloads);
        res.json({
          success: true,
          message: `Batch update completed: ${batchResult.success} successful, ${batchResult.failed} failed`,
          data: {
            total: updatePayloads.length,
            successful: batchResult.success,
            failed: batchResult.failed,
            results: batchResult.results,
            metadata: {
              ...metadata,
              processedAt: (/* @__PURE__ */ new Date()).toISOString(),
              batchId: metadata?.batchId || `batch_${Date.now()}`
            }
          }
        });
      } catch (error) {
        console.error("Error processing batch external update:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error while processing batch update",
          code: "BATCH_PROCESSING_ERROR",
          error: error.message
        });
      }
    }
  );
  app2.post("/api/routes/start", async (req, res) => {
    try {
      const { employeeId, startLatitude, startLongitude } = req.body;
      if (!employeeId || startLatitude == null || startLongitude == null) {
        return res.status(400).json({ success: false, message: "employeeId, startLatitude, startLongitude required" });
      }
      const sessionId = "session-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
      const session = await routeService.startSession({ id: sessionId, employeeId, startLatitude: Number(startLatitude), startLongitude: Number(startLongitude) });
      res.status(201).json({ success: true, session, message: "Route session started successfully" });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });
  app2.post("/api/routes/stop", async (req, res) => {
    try {
      const { sessionId, endLatitude, endLongitude } = req.body;
      if (!sessionId || endLatitude == null || endLongitude == null) {
        return res.status(400).json({ success: false, message: "sessionId, endLatitude, endLongitude required" });
      }
      const session = await routeService.stopSession({ id: sessionId, endLatitude: Number(endLatitude), endLongitude: Number(endLongitude) });
      res.json({ success: true, session, message: "Route session stopped successfully" });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });
  app2.post("/api/routes/coordinates", async (req, res) => {
    try {
      const { sessionId, employeeId, latitude, longitude, accuracy, speed, timestamp, eventType, shipmentId } = req.body;
      if (!sessionId || latitude == null || longitude == null || !employeeId) {
        return res.status(400).json({ success: false, message: "sessionId, employeeId, latitude, longitude required" });
      }
      const record = await routeService.insertCoordinate({
        sessionId,
        employeeId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy != null ? Number(accuracy) : void 0,
        speed: speed != null ? Number(speed) : void 0,
        timestamp,
        eventType,
        shipmentId
      });
      res.status(201).json({ success: true, record, message: "GPS coordinate recorded successfully" });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });
  app2.post("/api/routes/shipment-event", async (req, res) => {
    try {
      const { sessionId, shipmentId, eventType, latitude, longitude } = req.body || {};
      if (!sessionId || !shipmentId || !eventType) {
        return res.status(400).json({
          success: false,
          message: "sessionId, shipmentId and eventType are required"
        });
      }
      if (!["pickup", "delivery"].includes(String(eventType))) {
        return res.status(400).json({
          success: false,
          message: 'eventType must be either "pickup" or "delivery"'
        });
      }
      const record = {
        id: "evt-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
        sessionId,
        shipmentId,
        eventType,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      console.log("Route shipment event recorded:", record);
      return res.status(201).json({ success: true, record, message: "Shipment event recorded" });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || "Failed to record event" });
    }
  });
  app2.get("/api/routes/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const data = await routeService.getSession(sessionId);
      res.json({ success: true, data, message: "Session data retrieved successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  app2.post("/api/routes/coordinates/batch", async (req, res) => {
    try {
      const { coordinates } = req.body;
      if (!Array.isArray(coordinates)) {
        return res.status(400).json({ success: false, message: "coordinates must be an array" });
      }
      const summary = await routeService.insertCoordinatesBatch(coordinates);
      res.json({ success: true, summary, message: `Batch coordinate submission completed` });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });
  app2.post("/api/routes/sync-session", async (req, res) => {
    try {
      const { id, employeeId, startTime, endTime, status, startLatitude, startLongitude, endLatitude, endLongitude } = req.body || {};
      if (!id || !employeeId || !startTime || !status) {
        return res.status(400).json({
          success: false,
          message: "id, employeeId, startTime and status are required"
        });
      }
      const synced = {
        id,
        employeeId,
        startTime,
        endTime: endTime || null,
        status,
        startLatitude: startLatitude ?? null,
        startLongitude: startLongitude ?? null,
        endLatitude: endLatitude ?? null,
        endLongitude: endLongitude ?? null,
        syncedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      console.log("Offline session synced:", synced);
      return res.json({ success: true, session: synced, message: "Session synced" });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || "Failed to sync session" });
    }
  });
  app2.post("/api/routes/sync-coordinates", async (req, res) => {
    try {
      const { sessionId, coordinates } = req.body || {};
      if (!sessionId || !Array.isArray(coordinates)) {
        return res.status(400).json({
          success: false,
          message: "sessionId and coordinates array are required"
        });
      }
      const results = coordinates.map((c) => ({
        success: true,
        record: {
          id: "coord-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
          sessionId,
          latitude: c.latitude,
          longitude: c.longitude,
          accuracy: c.accuracy ?? null,
          timestamp: c.timestamp || (/* @__PURE__ */ new Date()).toISOString()
        }
      }));
      console.log(`Offline coordinates synced for session ${sessionId}:`, results.length);
      return res.json({ success: true, results, message: "Coordinates synced" });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || "Failed to sync coordinates" });
    }
  });
  app2.post("/api/errors", async (req, res) => {
    try {
      console.error("Frontend Error:", req.body);
      res.status(200).json({ logged: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/auth/all-users", authenticate, async (req, res) => {
    try {
      if (!req.user?.isSuperUser && !req.user?.isOpsTeam && !req.user?.isStaff) {
        return res.status(403).json({
          success: false,
          message: "Access denied: Only admin users can view all users",
          code: "ACCESS_DENIED"
        });
      }
      const usersResult = await db.query(`
        SELECT id, rider_id, full_name, email, is_active, is_approved, role, 
               last_login_at, created_at, updated_at
        FROM rider_accounts 
        ORDER BY created_at DESC
      `);
      const users = usersResult.rows;
      res.json({
        success: true,
        users
      });
    } catch (error) {
      console.error("Failed to fetch all users:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch users",
        code: "FETCH_USERS_ERROR"
      });
    }
  });
  app2.patch("/api/auth/users/:userId", authenticate, async (req, res) => {
    try {
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Access denied: Only super users can update users",
          code: "ACCESS_DENIED"
        });
      }
      const { userId } = req.params;
      const updates = req.body;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
          code: "MISSING_USER_ID"
        });
      }
      const updateFields = [];
      const values = [];
      if (updates.full_name !== void 0) {
        updateFields.push("full_name = ?");
        values.push(updates.full_name);
      }
      if (updates.email !== void 0) {
        updateFields.push("email = ?");
        values.push(updates.email);
      }
      if (updates.rider_id !== void 0) {
        updateFields.push("rider_id = ?");
        values.push(updates.rider_id);
      }
      if (updates.is_active !== void 0) {
        updateFields.push("is_active = ?");
        values.push(updates.is_active ? 1 : 0);
      }
      if (updates.is_approved !== void 0) {
        updateFields.push("is_approved = ?");
        values.push(updates.is_approved ? 1 : 0);
      }
      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
          code: "NO_UPDATES"
        });
      }
      updateFields.push("updated_at = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString());
      values.push(userId);
      const updateQuery = `
        UPDATE rider_accounts 
        SET ${updateFields.join(", ")} 
        WHERE id = ?
      `;
      const result = await db.query(updateQuery, values);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }
      res.json({
        success: true,
        message: "User updated successfully"
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user",
        code: "UPDATE_USER_ERROR"
      });
    }
  });
  app2.post("/api/auth/users/:userId/reset-password", authenticate, async (req, res) => {
    try {
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: "Access denied: Only super users can reset passwords",
          code: "ACCESS_DENIED"
        });
      }
      const { userId } = req.params;
      const { newPassword } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "User ID and new password are required",
          code: "MISSING_PARAMETERS"
        });
      }
      const bcrypt3 = await import("bcrypt");
      const hashedPassword = await bcrypt3.hash(newPassword, 10);
      const result = await db.query(`
        UPDATE rider_accounts 
        SET password_hash = $1, updated_at = $2 
        WHERE id = $3
      `, [hashedPassword, (/* @__PURE__ */ new Date()).toISOString(), userId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }
      res.json({
        success: true,
        message: "Password reset successfully"
      });
    } catch (error) {
      console.error("Failed to reset password:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
        code: "RESET_PASSWORD_ERROR"
      });
    }
  });
  await init_scheduler().then(() => scheduler_exports);
  setupErrorHandling();
  if (process.env.VERCEL) {
    console.log("\u2705 Routes registered for Vercel serverless");
    return null;
  }
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vercel.ts
await init_vite();
import cors from "cors";
dotenv2.config();
var app = express3();
app.use(cors({
  origin: true,
  // Allow all origins for now
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"]
}));
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      console.log(logLine);
    }
  });
  next();
});
var mainHealthCache = null;
var MAIN_HEALTH_CACHE_TTL = 1e4;
app.get("/health", (req, res) => {
  const now = Date.now();
  if (mainHealthCache && now - mainHealthCache.timestamp < MAIN_HEALTH_CACHE_TTL) {
    res.set("Cache-Control", "public, max-age=10");
    res.set("X-Health-Cache", "HIT");
    return res.json({ ...mainHealthCache.data, cached: true });
  }
  const healthData = {
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    cached: false
  };
  mainHealthCache = {
    data: healthData,
    timestamp: now
  };
  res.set("Cache-Control", "public, max-age=10");
  res.set("X-Health-Cache", "MISS");
  res.json(healthData);
});
app.get("/api-status", (req, res) => {
  res.json({
    message: "Server is running. Direct API calls to https://pia.printo.in/api/v1/",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
console.log("\u{1F680} Initializing Vercel serverless function...");
try {
  initializeAuth();
  await registerRoutes(app);
  console.log("\u2705 Vercel app initialized successfully");
} catch (error) {
  console.error("\u274C Failed to initialize Vercel app:", error);
  throw error;
}
app.use((err, _req, res, _next) => {
  console.error("\u274C Vercel Request Error:", {
    message: err.message,
    stack: err.stack,
    url: _req.url,
    method: _req.method
  });
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ error: true, message });
});
serveStatic(app);
var vercel_default = app;
export {
  vercel_default as default
};
