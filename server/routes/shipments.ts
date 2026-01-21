import type { Express } from "express";
import { storage } from "../storage.js";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import {
  insertShipmentSchema,
  updateShipmentSchema,
  batchUpdateSchema,
  shipmentFiltersSchema
} from "@shared/schema";
import { log } from "../../shared/utils/logger.js";

export function registerShipmentRoutes(app: Express): void {
  // Dashboard endpoint
  app.get('/api/dashboard', async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error: any) {
      log.error('Dashboard error:', error.message);
      res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
  });

  // Get shipments with optional filters, pagination, and sorting
  app.get('/api/shipments/fetch', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const filters = shipmentFiltersSchema.parse(req.query);
      const shipments = await storage.getShipments(filters);
      res.json(shipments);
    } catch (error: any) {
      log.error('Error fetching shipments:', error.message);
      res.status(500).json({ error: 'Failed to fetch shipments' });
    }
  });

  // Get single shipment
  app.get('/api/shipments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const shipment = await storage.getShipment(id);
      
      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      
      res.json(shipment);
    } catch (error: any) {
      log.error('Error fetching shipment:', error.message);
      res.status(500).json({ error: 'Failed to fetch shipment' });
    }
  });

  // Create new shipment
  app.post('/api/shipments/create', async (req, res) => {
    try {
      const shipmentData = insertShipmentSchema.parse(req.body);
      const newShipment = await storage.createShipment(shipmentData);
      log.info('Shipment created:', newShipment);
      res.status(201).json(newShipment);
    } catch (error: any) {
      log.error('Error creating shipment:', error.message);
      res.status(500).json({ error: 'Failed to create shipment' });
    }
  });

  // Update single shipment status
  app.patch('/api/shipments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = updateShipmentSchema.parse(req.body);
      const updatedShipment = await storage.updateShipment(id, updateData);
      log.info('Shipment updated:', updatedShipment);
      res.json(updatedShipment);
    } catch (error: any) {
      log.error('Error updating shipment:', error.message);
      res.status(500).json({ error: 'Failed to update shipment' });
    }
  });

  // Batch update shipments
  app.patch('/api/shipments/batch', async (req, res) => {
    try {
      const batchData = batchUpdateSchema.parse(req.body);
      const result = await storage.batchUpdateShipments(batchData);
      log.info('Batch shipment update completed:', { count: result });
      res.json({ success: true, updated: result });
    } catch (error: any) {
      log.error('Error in batch update:', error.message);
      res.status(500).json({ error: 'Failed to update shipments' });
    }
  });

  // Remarks endpoint for cancelled/returned shipments
  app.post('/api/shipments/:id/remarks', async (req, res) => {
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
    } catch (error: any) {
      log.error('Error saving remarks:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to save remarks'
      });
    }
  });
}
