import { ShipmentQueries } from './db/queries.js';
import { Shipment, InsertShipment, UpdateShipment, BatchUpdate, Acknowledgment, InsertAcknowledgment, DashboardMetrics, ShipmentFilters } from '@shared/schema';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface IStorage {
  // Shipment operations
  getShipments(filters?: ShipmentFilters): Promise<PaginatedResponse<Shipment>>;
  getShipment(id: string): Promise<Shipment | undefined>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: string, updates: UpdateShipment): Promise<Shipment | undefined>;
  batchUpdateShipments(updates: BatchUpdate): Promise<number>;

  // Acknowledgment operations
  createAcknowledgment(acknowledgment: InsertAcknowledgment): Promise<Acknowledgment>;
  getAcknowledgmentByShipmentId(shipmentId: string): Promise<Acknowledgment | undefined>;

  // Dashboard operations
  getDashboardMetrics(): Promise<DashboardMetrics>;
}

export class SqliteStorage implements IStorage {
  private liveQueries: ShipmentQueries;
  private replicaQueries: ShipmentQueries;

  constructor() {
    // In development mode, primary operations use replica DB
    const isDevelopment = process.env.NODE_ENV === 'development';
    this.liveQueries = new ShipmentQueries(isDevelopment);
    this.replicaQueries = new ShipmentQueries(!isDevelopment);
  }

  // Expose database for validation services
  getDatabase() {
    return this.liveQueries.getDatabase();
  }

  // Direct database access methods for compatibility
  prepare(sql: string) {
    return this.liveQueries.getDatabase().prepare(sql);
  }

  exec(sql: string) {
    return this.liveQueries.getDatabase().exec(sql);
  }

  async getShipments(filters?: ShipmentFilters): Promise<PaginatedResponse<Shipment>> {
    return this.liveQueries.getAllShipments(filters);
  }

  async getShipment(id: string): Promise<Shipment | undefined> {
    const shipment = this.liveQueries.getShipmentById(id);
    return shipment || undefined;
  }

  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    return this.liveQueries.createShipment(shipment);
  }

  async updateShipment(id: string, updates: UpdateShipment): Promise<Shipment | undefined> {
    const shipment = this.liveQueries.updateShipment(id, updates);
    return shipment || undefined;
  }

  async batchUpdateShipments(updates: BatchUpdate): Promise<number> {
    return this.liveQueries.batchUpdateShipments(updates.updates);
  }

  async createAcknowledgment(acknowledgment: InsertAcknowledgment): Promise<Acknowledgment> {
    return this.liveQueries.createAcknowledgment(acknowledgment);
  }

  async getAcknowledgmentByShipmentId(shipmentId: string): Promise<Acknowledgment | undefined> {
    const acknowledgment = this.liveQueries.getAcknowledmentByShipmentId(shipmentId);
    return acknowledgment || undefined;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return this.liveQueries.getDashboardMetrics();
  }
}

export const storage = new SqliteStorage();
