import { ShipmentQueries, UserSession, InsertUser, UpdateUser, FeatureFlag, UpdateFeatureFlag, SystemHealthMetric, RiderAccount, InsertRiderAccount } from './db/queries.js';
import { RouteTrackingQueries } from './db/routeQueries.js';
import { Shipment, InsertShipment, UpdateShipment, BatchUpdate, DashboardMetrics, ShipmentFilters, VehicleType, InsertVehicleType, UpdateVehicleType, FuelSetting, InsertFuelSetting, UpdateFuelSetting, Acknowledgment, InsertAcknowledgment, User, GPSCoordinate, RouteSession, RouteTracking, RouteAnalytics, RouteFilters } from '@shared/types';

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
  batchCreateOrUpdateShipments(shipments: Array<{ external: { id: string }, internal: InsertShipment & { piashipmentid?: string, id?: string } }>): Promise<Array<{
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
  }): Promise<Record<string, unknown>>;

  startRouteSession(data: {
    id: string;
    employeeId: string;
    startLatitude: number;
    startLongitude: number;
    shipmentId?: string;
  }): Promise<Record<string, unknown>>;

  stopRouteSession(data: {
    sessionId: string;
    endLatitude: number;
    endLongitude: number;
  }): Promise<Record<string, unknown>>;

  recordCoordinate(data: {
    sessionId: string;
    latitude: number;
    longitude: number;
    timestamp?: string;
    employeeId?: string;
  }): Promise<Record<string, unknown>>;

  // Route Query Operations
  getRouteSession(sessionId: string): Promise<RouteSession | null>;
  getSessionCoordinates(sessionId: string): Promise<RouteTracking[]>;
  getRouteAnalytics(filters?: RouteFilters): Promise<RouteAnalytics[]>;

  // Acknowledgment operations
  createAcknowledgment(acknowledgment: InsertAcknowledgment): Promise<Acknowledgment>;
  getAcknowledgmentByShipmentId(shipmentId: string): Promise<Acknowledgment | undefined>;

  // Dashboard operations
  getDashboardMetrics(employeeId?: string): Promise<DashboardMetrics>;

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

  // Feature Flags
  getFeatureFlag(name: string): Promise<FeatureFlag | undefined>;
  getAllFeatureFlags(): Promise<FeatureFlag[]>;
  updateFeatureFlag(name: string, updates: UpdateFeatureFlag): Promise<FeatureFlag | undefined>;

  // System Health
  createSystemHealthMetric(metric: Omit<SystemHealthMetric, 'created_at'>): Promise<SystemHealthMetric>;
  getSystemHealthMetrics(limit?: number): Promise<SystemHealthMetric[]>;

  // User & Session (Auth)
  getUserByToken(token: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User | undefined>;
  createSession(session: UserSession): Promise<UserSession>;
  getSessionByToken(token: string): Promise<UserSession | undefined>;
  updateSession(id: string, token: string, expiresAt: string): Promise<UserSession | undefined>;
  deleteExpiredSessions(): Promise<number>;
}

export class DbStorage implements IStorage {
  private queries: ShipmentQueries;
  private routeQueries: RouteTrackingQueries;

  constructor() {
    this.queries = new ShipmentQueries();
    this.routeQueries = new RouteTrackingQueries();
  }

  // Expose pool for rare cases where direct access is needed (try to avoid)
  getDatabase() {
    return this.queries.getDatabase();
  }

  // Route Query Implementations
  async getRouteSession(sessionId: string): Promise<RouteSession | null> {
    return this.routeQueries.getRouteSession(sessionId);
  }

  async getSessionCoordinates(sessionId: string): Promise<RouteTracking[]> {
    return this.routeQueries.getSessionCoordinates(sessionId);
  }

  async getRouteAnalytics(filters?: RouteFilters): Promise<RouteAnalytics[]> {
    return this.routeQueries.getRouteAnalytics(filters);
  }

  async getShipments(filters?: ShipmentFilters): Promise<PaginatedResponse<Shipment>> {
    return this.queries.getAllShipments(filters);
  }

  async getShipment(id: string): Promise<Shipment | undefined> {
    return this.queries.getShipmentById(id);
  }

  async getShipmentByExternalId(externalId: string): Promise<Shipment | undefined> {
    return this.queries.getShipmentByExternalId(externalId);
  }

  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    return this.queries.createShipment(shipment);
  }

  async updateShipment(id: string, updates: UpdateShipment): Promise<Shipment | undefined> {
    return this.queries.updateShipment(id, updates);
  }

  async batchUpdateShipments(updates: BatchUpdate): Promise<number> {
    return this.queries.batchUpdateShipments(updates.updates);
  }

  async batchCreateOrUpdateShipments(shipments: Array<{ external: { id: string }, internal: InsertShipment & { piashipmentid?: string, id?: string } }>): Promise<Array<{
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
    return this.queries.getAcknowledmentByShipmentId(shipmentId);
  }

  async getDashboardMetrics(employeeId?: string): Promise<DashboardMetrics> {
    return this.queries.getDashboardMetrics(employeeId);
  }

  async getVehicleTypes(): Promise<VehicleType[]> {
    return this.queries.getAllVehicleTypes();
  }

  async getVehicleType(id: string): Promise<VehicleType | undefined> {
    return this.queries.getVehicleTypeById(id);
  }

  async createVehicleType(vehicleType: InsertVehicleType): Promise<VehicleType> {
    return this.queries.createVehicleType(vehicleType);
  }

  async updateVehicleType(id: string, updates: UpdateVehicleType): Promise<VehicleType | undefined> {
    return this.queries.updateVehicleType(id, updates);
  }

  async deleteVehicleType(id: string): Promise<boolean> {
    return this.queries.deleteVehicleType(id);
  }

  async getFuelSettings(): Promise<FuelSetting[]> {
    return this.queries.getAllFuelSettings();
  }

  async getFuelSetting(id: string): Promise<FuelSetting | undefined> {
    return this.queries.getFuelSettingById(id);
  }

  async createFuelSetting(fuelSetting: InsertFuelSetting): Promise<FuelSetting> {
    return this.queries.createFuelSetting(fuelSetting);
  }

  async updateFuelSetting(id: string, updates: UpdateFuelSetting): Promise<FuelSetting | undefined> {
    return this.queries.updateFuelSetting(id, updates);
  }

  async deleteFuelSetting(id: string): Promise<boolean> {
    return this.queries.deleteFuelSetting(id);
  }

  async recordShipmentEvent(event: {
    sessionId: string;
    shipmentId: string;
    eventType: string;
    latitude: number;
    longitude: number;
    employeeId: string;
  }): Promise<Record<string, unknown>> {
    const result = await this.routeQueries.recordShipmentEvent(
      event.sessionId,
      event.shipmentId,
      event.eventType as 'pickup' | 'delivery',
      event.latitude,
      event.longitude
    );
    return result as unknown as Record<string, unknown>;
  }

  async startRouteSession(data: {
    id: string;
    employeeId: string;
    startLatitude: number;
    startLongitude: number;
    shipmentId?: string;
  }): Promise<Record<string, unknown>> {
    const session = await this.routeQueries.createRouteSession(
      data.employeeId,
      data.startLatitude,
      data.startLongitude,
      data.id
    );

    if (data.shipmentId) {
      await this.routeQueries.recordShipmentEvent(
        data.id,
        data.shipmentId,
        'pickup', // Assuming pickup on start, or should it be 'route_start'? RouteTrackingQueries expects 'pickup' | 'delivery'
        data.startLatitude,
        data.startLongitude
      );
    }

    return session as unknown as Record<string, unknown>;
  }

  async stopRouteSession(data: {
    sessionId: string;
    endLatitude: number;
    endLongitude: number;
  }): Promise<Record<string, unknown>> {
    const session = await this.routeQueries.stopRouteSession(
      data.sessionId,
      data.endLatitude,
      data.endLongitude
    );
    return session as unknown as Record<string, unknown>;
  }

  async recordCoordinate(data: {
    sessionId: string;
    latitude: number;
    longitude: number;
    timestamp?: string;
    employeeId?: string;
  }): Promise<Record<string, unknown>> {
    const coord: GPSCoordinate = {
      sessionId: data.sessionId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: data.timestamp || new Date().toISOString()
    };
    const result = await this.routeQueries.recordGPSCoordinate(coord);
    return result as unknown as Record<string, unknown>;
  }

  // Feature Flags
  async getFeatureFlag(name: string): Promise<FeatureFlag | undefined> {
    return this.queries.getFeatureFlag(name);
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return this.queries.getAllFeatureFlags();
  }

  async updateFeatureFlag(name: string, updates: UpdateFeatureFlag): Promise<FeatureFlag | undefined> {
    return this.queries.updateFeatureFlag(name, updates);
  }

  // Rider Account Operations
  async createRiderAccount(account: InsertRiderAccount): Promise<RiderAccount> {
    return this.queries.createRiderAccount(account);
  }

  async getRiderAccountByRiderId(riderId: string): Promise<RiderAccount | undefined> {
    return this.queries.getRiderAccountByRiderId(riderId);
  }

  async getRiderAccountById(id: string): Promise<RiderAccount | undefined> {
    return this.queries.getRiderAccountById(id);
  }

  // System Health
  async createSystemHealthMetric(metric: Omit<SystemHealthMetric, 'created_at'>): Promise<SystemHealthMetric> {
    return this.queries.createSystemHealthMetric(metric);
  }

  async getSystemHealthMetrics(limit?: number): Promise<SystemHealthMetric[]> {
    return this.queries.getSystemHealthMetrics(limit);
  }

  // User & Session
  async getUserByToken(token: string): Promise<User | undefined> {
    return this.queries.getUserByToken(token);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.queries.getUserById(id);
  }

  async createUser(user: InsertUser): Promise<User> {
    return this.queries.createUser(user);
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    return this.queries.updateUser(id, updates);
  }

  async createSession(session: UserSession): Promise<UserSession> {
    return this.queries.createSession(session);
  }

  async getSessionByToken(token: string): Promise<UserSession | undefined> {
    return this.queries.getSessionByToken(token);
  }

  async updateSession(id: string, token: string, expiresAt: string): Promise<UserSession | undefined> {
    return this.queries.updateSession(id, token, expiresAt);
  }

  async deleteExpiredSessions(): Promise<number> {
    return this.queries.deleteExpiredSessions();
  }
}

export const storage = new DbStorage();
