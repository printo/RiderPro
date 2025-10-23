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



  // Acknowledgment operations (now integrated into shipments table)
  createAcknowledgment(acknowledgment: any): Promise<any>;
  getAcknowledgmentByShipmentId(shipmentId: string): Promise<any | undefined>;

  // Dashboard operations
  getDashboardMetrics(): Promise<DashboardMetrics>;
  getDashboardMetricsForEmployee(employeeId: string): Promise<DashboardMetrics>;

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

export class PostgresStorage implements IStorage {
  private queries: ShipmentQueries;

  constructor() {
    this.queries = new ShipmentQueries();
  }

  // Expose database for validation services
  getDatabase() {
    return this.queries.getDatabase();
  }

  // Direct database access methods for compatibility
  prepare(sql: string) {
    return this.queries.getDatabase().prepare(sql);
  }

  exec(sql: string) {
    return this.queries.getDatabase().exec(sql);
  }

  async getShipments(filters?: ShipmentFilters): Promise<PaginatedResponse<Shipment>> {
    return this.queries.getAllShipments(filters);
  }

  async getShipment(id: string): Promise<Shipment | undefined> {
    const shipment = await this.queries.getShipmentById(id);
    return shipment || undefined;
  }

  async getShipmentByExternalId(externalId: string): Promise<Shipment | undefined> {
    const shipment = await this.queries.getShipmentByExternalId(externalId);
    return shipment || undefined;
  }

  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    return await this.queries.createShipment(shipment);
  }

  async updateShipment(id: string, updates: UpdateShipment): Promise<Shipment | undefined> {
    const shipment = await this.queries.updateShipment(id, updates);
    return shipment || undefined;
  }

  async batchUpdateShipments(updates: BatchUpdate): Promise<number> {
    return await this.queries.batchUpdateShipments(updates.updates);
  }

  async batchCreateOrUpdateShipments(shipments: Array<{ external: any, internal: any }>): Promise<Array<{
    piashipmentid: string;
    internalId: string | null;
    status: 'created' | 'updated' | 'failed';
    message: string;
  }>> {
    return this.queries.batchCreateOrUpdateShipments(shipments);
  }

  async createAcknowledgment(acknowledgment: InsertAcknowledgment): Promise<Acknowledgment> {
    return this.queries.createAcknowledgment(acknowledgment);
  }

  async getAcknowledgmentByShipmentId(shipmentId: string): Promise<Acknowledgment | undefined> {
    const acknowledgment = await this.queries.getAcknowledmentByShipmentId(shipmentId);
    return acknowledgment || undefined;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return this.queries.getDashboardMetrics();
  }

  async getDashboardMetricsForEmployee(employeeId: string): Promise<DashboardMetrics> {
    return this.queries.getDashboardMetricsForEmployee(employeeId);
  }

  // Vehicle Types operations
  async getVehicleTypes(): Promise<VehicleType[]> {
    return this.queries.getAllVehicleTypes();
  }

  async getVehicleType(id: string): Promise<VehicleType | undefined> {
    const vehicleType = await this.queries.getVehicleTypeById(id);
    return vehicleType || undefined;
  }

  async createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType> {
    return this.queries.createVehicleType(vehicleType);
  }

  async updateVehicleType(id: string, updates: UpdateVehicleType): Promise<VehicleType | undefined> {
    const vehicleType = await this.queries.updateVehicleType(id, updates);
    return vehicleType || undefined;
  }

  async deleteVehicleType(id: string): Promise<boolean> {
    return this.queries.deleteVehicleType(id);
  }

  // Fuel Settings operations
  async getFuelSettings(): Promise<FuelSetting[]> {
    return this.queries.getAllFuelSettings();
  }

  async getFuelSetting(id: string): Promise<FuelSetting | undefined> {
    const fuelSetting = await this.queries.getFuelSettingById(id);
    return fuelSetting || undefined;
  }

  async createFuelSetting(fuelSetting: InsertFuelSetting): Promise<FuelSetting> {
    return this.queries.createFuelSetting(fuelSetting);
  }

  async updateFuelSetting(id: string, updates: UpdateFuelSetting): Promise<FuelSetting | undefined> {
    const fuelSetting = await this.queries.updateFuelSetting(id, updates);
    return fuelSetting || undefined;
  }

  async deleteFuelSetting(id: string): Promise<boolean> {
    return this.queries.deleteFuelSetting(id);
  }

}

export const storage = new PostgresStorage();
