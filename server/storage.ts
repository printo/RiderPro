import { ShipmentQueries } from './db/queries.js';
import { Shipment, InsertShipment, UpdateShipment, BatchUpdate, DashboardMetrics, ShipmentFilters, VehicleType, InsertVehicleType, UpdateVehicleType, FuelSetting, InsertFuelSetting, UpdateFuelSetting, Acknowledgment, InsertAcknowledgment } from '@shared/schema';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface IStorage {
  // Shipment operations
  getShipments(filters?: ShipmentFilters): Promise<PaginatedResponse<Shipment>>;
  getShipment(id: string): Promise<Shipment | undefined>;
  getShipmentByExternalId(externalId: string): Promise<Shipment | undefined>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: string, updates: UpdateShipment): Promise<Shipment | undefined>;
  batchUpdateShipments(updates: BatchUpdate): Promise<number>;
  batchCreateOrUpdateShipments(shipments: Array<{ external: any, internal: any }>): Promise<Array<{
    piashipmentid: string;
    internalId: string | null;
    status: 'created' | 'updated' | 'failed';
    message: string;
  }>>;

  recordShipmentEvent(event: {
    sessionId: string;
    shipmentId: string;
    eventType: string;
    latitude: number;
    longitude: number;
    employeeId: string;
  }): Promise<any>;

  startRouteSession(data: any): Promise<any>;
  stopRouteSession(data: any): Promise<any>;
  recordCoordinate(data: any): Promise<any>;



  // Acknowledgment operations (now integrated into shipments table)
  createAcknowledgment(acknowledgment: any): Promise<any>;
  getAcknowledgmentByShipmentId(shipmentId: string): Promise<any | undefined>;

  // Dashboard operations
  getDashboardMetrics(): Promise<DashboardMetrics>;

  // Vehicle Types operations
  getVehicleTypes(): Promise<VehicleType[]>;
  getVehicleType(id: string): Promise<VehicleType | undefined>;
  createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType>;
  updateVehicleType(id: string, updates: UpdateVehicleType): Promise<VehicleType | undefined>;
  deleteVehicleType(id: string): Promise<boolean>;

  // Fuel Settings operations
  getFuelSettings(): Promise<FuelSetting[]>;
  getFuelSetting(id: string): Promise<FuelSetting | undefined>;
  createFuelSetting(fuelSetting: InsertFuelSetting): Promise<FuelSetting>;
  updateFuelSetting(id: string, updates: UpdateFuelSetting): Promise<FuelSetting | undefined>;
  deleteFuelSetting(id: string): Promise<boolean>;
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

  async getShipmentByExternalId(externalId: string): Promise<Shipment | undefined> {
    const shipment = this.liveQueries.getShipmentByExternalId(externalId);
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

  async batchCreateOrUpdateShipments(shipments: Array<{ external: any, internal: any }>): Promise<Array<{
    piashipmentid: string;
    internalId: string | null;
    status: 'created' | 'updated' | 'failed';
    message: string;
  }>> {
    return this.liveQueries.batchCreateOrUpdateShipments(shipments);
  }

  async createAcknowledgment(acknowledgment: InsertAcknowledgment): Promise<Acknowledgment> {
    return this.liveQueries.createAcknowledgment(acknowledgment);
  }

  async getAcknowledgmentByShipmentId(shipmentId: string): Promise<Acknowledgment | undefined> {
    const acknowledgment = this.liveQueries.getAcknowledmentByShipmentId(shipmentId);
    return acknowledgment || undefined;
  }

  async getDashboardMetrics(employeeId?: string): Promise<DashboardMetrics> {
    return this.liveQueries.getDashboardMetrics(employeeId);
  }

  // Vehicle Types operations
  async getVehicleTypes(): Promise<VehicleType[]> {
    return this.liveQueries.getAllVehicleTypes();
  }

  async getVehicleType(id: string): Promise<VehicleType | undefined> {
    const vehicleType = this.liveQueries.getVehicleTypeById(id);
    return vehicleType || undefined;
  }

  async createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType> {
    return this.liveQueries.createVehicleType(vehicleType);
  }

  async updateVehicleType(id: string, updates: UpdateVehicleType): Promise<VehicleType | undefined> {
    const vehicleType = this.liveQueries.updateVehicleType(id, updates);
    return vehicleType || undefined;
  }

  async deleteVehicleType(id: string): Promise<boolean> {
    return this.liveQueries.deleteVehicleType(id);
  }

  // Fuel Settings operations
  async getFuelSettings(): Promise<FuelSetting[]> {
    return this.liveQueries.getAllFuelSettings();
  }

  async getFuelSetting(id: string): Promise<FuelSetting | undefined> {
    const fuelSetting = this.liveQueries.getFuelSettingById(id);
    return fuelSetting || undefined;
  }

  async createFuelSetting(fuelSetting: InsertFuelSetting): Promise<FuelSetting> {
    return this.liveQueries.createFuelSetting(fuelSetting);
  }

  async updateFuelSetting(id: string, updates: UpdateFuelSetting): Promise<FuelSetting | undefined> {
    const fuelSetting = this.liveQueries.updateFuelSetting(id, updates);
    return fuelSetting || undefined;
  }

  async recordShipmentEvent(event: {
    sessionId: string;
    shipmentId: string;
    eventType: string;
    latitude: number;
    longitude: number;
    employeeId: string;
  }): Promise<any> {
    return this.liveQueries.recordShipmentEvent(event);
  }

  async startRouteSession(data: any): Promise<any> {
    return this.liveQueries.startRouteSession(data);
  }

  async stopRouteSession(data: any): Promise<any> {
    return this.liveQueries.stopRouteSession(data);
  }

  async recordCoordinate(data: any): Promise<any> {
    return this.liveQueries.recordCoordinate(data);
  }

  async deleteFuelSetting(id: string): Promise<boolean> {
    return this.liveQueries.deleteFuelSetting(id);
  }

}

export const storage = new SqliteStorage();
