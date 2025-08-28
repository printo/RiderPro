import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage.js";
import { insertShipmentSchema, updateShipmentSchema, batchUpdateSchema, insertAcknowledgmentSchema, shipmentFiltersSchema } from "@shared/schema";
import { upload, getFileUrl, saveBase64File } from "./utils/fileUpload.js";
import { externalSync } from "./services/externalSync.js";
import path from 'path';

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    // Add CORS headers for file access
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    next();
  });
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Dashboard endpoint
  app.get('/api/dashboard', async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get shipments with optional filters
  app.get('/api/shipments', async (req, res) => {
    try {
      const filters = shipmentFiltersSchema.parse(req.query);
      const shipments = await storage.getShipments(filters);
      res.json(shipments);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get single shipment
  app.get('/api/shipments/:id', async (req, res) => {
    try {
      const shipment = await storage.getShipment(req.params.id);
      if (!shipment) {
        return res.status(404).json({ message: 'Shipment not found' });
      }

      // Also get acknowledgment if exists
      const acknowledgment = await storage.getAcknowledgmentByShipmentId(shipment.id);
      
      res.json({ shipment, acknowledgment });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new shipment
  app.post('/api/shipments', async (req, res) => {
    try {
      const shipmentData = insertShipmentSchema.parse(req.body);
      const shipment = await storage.createShipment(shipmentData);
      
      // Sync to external API
      externalSync.syncShipmentUpdate(shipment).catch(err => {
        console.error('External sync failed for new shipment:', err);
      });

      res.status(201).json(shipment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update single shipment status
  app.patch('/api/shipments/:id', async (req, res) => {
    try {
      const updates = updateShipmentSchema.parse(req.body);
      const shipment = await storage.updateShipment(req.params.id, updates);
      
      if (!shipment) {
        return res.status(404).json({ message: 'Shipment not found' });
      }

      // Sync to external API
      externalSync.syncShipmentUpdate(shipment).catch(err => {
        console.error('External sync failed for shipment update:', err);
      });

      res.json(shipment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Batch update shipments
  app.patch('/api/shipments/batch', async (req, res) => {
    try {
      const batchData = batchUpdateSchema.parse(req.body);
      const updatedCount = await storage.batchUpdateShipments(batchData);
      
      // Get updated shipments for external sync
      const updatedShipments = await Promise.all(
        batchData.updates.map(async (update) => {
          const shipment = await storage.getShipment(update.id);
          return shipment;
        })
      );

      const validShipments = updatedShipments.filter(Boolean) as any[];
      
      // Batch sync to external API
      externalSync.batchSyncShipments(validShipments).catch(err => {
        console.error('External batch sync failed:', err);
      });

      res.json({ updatedCount, message: `${updatedCount} shipments updated successfully` });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Upload acknowledgment with photo and signature
  app.post('/api/shipments/:id/acknowledgement', 
    upload.fields([
      { name: 'photo', maxCount: 1 },
      { name: 'signature', maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const shipmentId = req.params.id;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const { signatureData } = req.body;

        // Verify shipment exists
        const shipment = await storage.getShipment(shipmentId);
        if (!shipment) {
          return res.status(404).json({ message: 'Shipment not found' });
        }

        let signatureUrl: string | undefined;
        let photoUrl: string | undefined;

        // Handle uploaded photo
        if (files.photo && files.photo[0]) {
          photoUrl = getFileUrl(files.photo[0].filename, 'photo');
        }

        // Handle signature (either uploaded file or base64 data)
        if (files.signature && files.signature[0]) {
          signatureUrl = getFileUrl(files.signature[0].filename, 'signature');
        } else if (signatureData) {
          try {
            const filename = saveBase64File(signatureData, 'signature');
            signatureUrl = getFileUrl(filename, 'signature');
          } catch (error) {
            console.error('Failed to save signature data:', error);
          }
        }

        // Create acknowledgment record
        const acknowledgment = await storage.createAcknowledgment({
          shipmentId,
          signatureUrl,
          photoUrl,
          capturedAt: new Date().toISOString(),
        });

        // Sync to external API with acknowledgment
        externalSync.syncShipmentUpdate(shipment, acknowledgment).catch(err => {
          console.error('External sync failed for acknowledgment:', err);
        });

        res.status(201).json(acknowledgment);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    }
  );

  // Sync status endpoints
  app.get('/api/sync/stats', async (req, res) => {
    try {
      // Mock sync stats for now - would be implemented with actual sync tracking
      const stats = {
        totalPending: 2,
        totalSent: 5,
        totalFailed: 1,
        lastSyncTime: new Date().toISOString(),
      };
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/sync/trigger', async (req, res) => {
    try {
      // Get all shipments that need syncing
      const shipments = await storage.getShipments();
      const result = await externalSync.batchSyncShipments(shipments);
      
      res.json({ 
        processed: shipments.length,
        success: result.success,
        failed: result.failed 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Remarks endpoint for cancelled/returned shipments
  app.post('/api/shipments/:id/remarks', async (req, res) => {
    try {
      const shipmentId = req.params.id;
      const { remarks, status } = req.body;
      
      if (!remarks || !status) {
        return res.status(400).json({ message: 'Remarks and status are required' });
      }
      
      // Verify shipment exists
      const shipment = await storage.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ message: 'Shipment not found' });
      }
      
      // For now, just store remarks in a simple way
      // In production, this would be a proper table
      console.log(`Remarks for shipment ${shipmentId} (${status}):`, remarks);
      
      res.status(201).json({ 
        shipmentId, 
        remarks, 
        status,
        savedAt: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Error logging endpoint
  app.post('/api/errors', async (req, res) => {
    try {
      // Log error (in production, would save to monitoring service)
      console.error('Frontend Error:', req.body);
      res.status(200).json({ logged: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Initialize scheduler (runs the cron jobs)
  await import('./services/scheduler.js');

  const httpServer = createServer(app);
  return httpServer;
}
