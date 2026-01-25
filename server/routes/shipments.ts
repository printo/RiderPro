import type { Express, Request, Response } from "express";
import { storage } from "../storage.js";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import {
  insertShipmentSchema,
  updateShipmentSchema,
  batchUpdateSchema,
  shipmentFiltersSchema
} from "@shared/types";
import { log } from "../../shared/utils/logger.js";

export function registerShipmentRoutes(app: Express): void {
  // Dashboard endpoint
  app.get('/api/dashboard', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Determine if we should filter by employeeId
      let employeeIdFilter: string | undefined = undefined;

      if (!req.user?.isSuperUser && !req.user?.isOpsTeam && !req.user?.isStaff) {
        employeeIdFilter = req.user?.employeeId;
      }

      const metrics = await storage.getDashboardMetrics(employeeIdFilter);
      res.json(metrics);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Dashboard error:', errorMessage);
      res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
  });

  // Get shipments with optional filters, pagination, and sorting
  app.get('/api/shipments/fetch', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const filters = shipmentFiltersSchema.parse(req.query);

      // Apply role-based filtering:
      // Admins/Ops/Staff see all. Regular riders see only their own.
      if (!req.user?.isSuperUser && !req.user?.isOpsTeam && !req.user?.isStaff) {
        filters.employeeId = req.user?.employeeId;
      }

      const result = await storage.getShipments(filters);

      // Set pagination headers for the client
      const page = Math.max(1, parseInt(filters.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit as string) || 20));
      const totalPages = Math.ceil(result.total / limit);

      res.setHeader('X-Total-Count', result.total.toString());
      res.setHeader('X-Total-Pages', totalPages.toString());
      res.setHeader('X-Current-Page', page.toString());
      res.setHeader('X-Per-Page', limit.toString());
      res.setHeader('X-Has-Next-Page', (page < totalPages).toString());
      res.setHeader('X-Has-Previous-Page', (page > 1).toString());

      res.json(result.data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Error fetching shipments:', errorMessage);
      res.status(500).json({ error: 'Failed to fetch shipments' });
    }
  });

  // Get single shipment
  app.get('/api/shipments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const shipment = await storage.getShipment(id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      res.json(shipment);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Error fetching shipment:', errorMessage);
      res.status(500).json({ error: 'Failed to fetch shipment' });
    }
  });

  // Create new shipment
  app.post('/api/shipments/create', async (req: Request, res: Response) => {
    try {
      const shipmentData = insertShipmentSchema.parse(req.body);
      const newShipment = await storage.createShipment(shipmentData);
      log.info('Shipment created:', newShipment);
      res.status(201).json(newShipment);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Error creating shipment:', errorMessage);
      res.status(500).json({ error: 'Failed to create shipment' });
    }
  });

  // Update single shipment status
  app.patch('/api/shipments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = updateShipmentSchema.parse(req.body);
      const updatedShipment = await storage.updateShipment(id, updateData);
      log.info('Shipment updated:', updatedShipment);
      res.json(updatedShipment);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Error updating shipment:', errorMessage);
      res.status(500).json({ error: 'Failed to update shipment' });
    }
  });

  // Batch update shipments
  app.patch('/api/shipments/batch', async (req: Request, res: Response) => {
    try {
      const batchData = batchUpdateSchema.parse(req.body);
      const result = await storage.batchUpdateShipments(batchData);
      log.info('Batch shipment update completed:', { count: result });
      res.json({ success: true, updated: result });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Error in batch update:', errorMessage);
      res.status(500).json({ error: 'Failed to update shipments' });
    }
  });

  // Remarks endpoint for cancelled/returned shipments
  app.post('/api/shipments/:id/remarks', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;

      if (!status || !remarks) {
        return res.status(400).json({
          success: false,
          message: 'Status and remarks are required'
        });
      }

      log.debug(`Remarks for shipment ${id} (${status}):`, remarks);

      res.status(201).json({
        success: true,
        message: 'Remarks saved successfully'
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Error saving remarks:', errorMessage);
      res.status(500).json({
        success: false,
        message: 'Failed to save remarks'
      });
    }
  });
}
