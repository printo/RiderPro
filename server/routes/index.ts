import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerHealthRoutes } from "./health.js";
import { registerAuthRoutes } from "./auth.js";
import { registerShipmentRoutes } from "./shipments.js";
import { registerVehicleRoutes } from "./vehicles.js";
import { registerRouteTrackingRoutes } from "./routeTracking.js";
import { registerUserManagementRoutes } from "./userManagement.js";
import { registerSyncRoutes } from "./sync.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register all route modules
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerShipmentRoutes(app);
  registerVehicleRoutes(app);
  registerRouteTrackingRoutes(app);
  registerUserManagementRoutes(app);
  registerSyncRoutes(app);

  // Create HTTP server
  const server = createServer(app);

  return server;
}