import type { Express, Request, Response } from "express";
import { storage } from "../storage.js";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import {
  insertShipmentSchema,
  updateShipmentSchema,
  batchUpdateSchema,
  shipmentFiltersSchema,
  UpdateShipment
} from "@shared/types";
import { log } from "../../shared/utils/logger.js";
import { upload, getFileUrl, saveBase64File, processImage } from "../utils/fileUpload.js";
import { externalSync } from "../services/externalSync.js";

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
      
      // Force sync reset so changes are propagated to external API
      const updatesWithSyncReset = {
        ...updateData,
        synced_to_external: false,
        sync_status: 'pending',
        sync_error: null,
        sync_attempts: 0
      };

      const updatedShipment = await storage.updateShipment(id, updatesWithSyncReset);
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
      
      // Force sync reset for each update
      for (const update of batchData.updates) {
        update.synced_to_external = false;
        update.sync_status = 'pending';
        update.sync_error = null;
        update.sync_attempts = 0;
      }

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

      // Verify shipment exists
      const shipment = await storage.getShipment(id);
      if (!shipment) {
        return res.status(404).json({ message: 'Shipment not found' });
      }

      // Update shipment with remarks and status
      // Also reset sync status so it gets pushed to external API
      const updates: UpdateShipment = {
        shipment_id: id,
        remarks: remarks,
        status: status,
        // Reset sync status to force re-sync
        synced_to_external: false,
        sync_status: 'pending',
        sync_error: null,
        sync_attempts: 0
      };

      // Validate status update based on shipment type
      if (status === "Delivered" && shipment.type !== "delivery") {
        return res.status(400).json({ message: 'Cannot mark a pickup shipment as Delivered' });
      }
      if (status === "Picked Up" && shipment.type !== "pickup") {
        return res.status(400).json({ message: 'Cannot mark a delivery shipment as Picked Up' });
      }

      const updatedShipment = await storage.updateShipment(id, updates);

      if (!updatedShipment) {
        return res.status(500).json({ message: 'Failed to update shipment' });
      }

      log.info(`Remarks added for shipment ${id} (${status}): ${remarks}. Sync status reset.`);

      res.status(200).json({
        success: true,
        message: 'Remarks saved successfully',
        shipment: updatedShipment
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

  // Upload acknowledgment with photo and signature
  app.post('/api/shipments/:id/acknowledgement',
    authenticate, // Enable authentication to track who captured the acknowledgment
    upload.fields([
      { name: 'photo', maxCount: 1 },
      { name: 'signature', maxCount: 1 }
    ]),
    async (req: AuthenticatedRequest, res: Response) => {
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
        if (files?.photo?.[0]) {
          try {
            const filename = await processImage(files.photo[0], 'photo');
            photoUrl = getFileUrl(filename, 'photo');
          } catch (error) {
            log.error('Failed to process uploaded photo:', error);
          }
        }

        // Handle signature (either uploaded file or base64 data)
        if (files?.signature?.[0]) {
          try {
            const filename = await processImage(files.signature[0], 'signature');
            signatureUrl = getFileUrl(filename, 'signature');
          } catch (error) {
            log.error('Failed to process uploaded signature:', error);
          }
        } else if (signatureData) {
          try {
            const filename = await saveBase64File(signatureData, 'signature');
            signatureUrl = getFileUrl(filename, 'signature');
          } catch (error) {
            log.error('Failed to save signature data:', error);
          }
        }

        // Create acknowledgment record with user tracking
        const acknowledgment = await storage.createAcknowledgment({
          shipment_id: shipmentId,
          signatureUrl: signatureUrl,
          photoUrl: photoUrl,
          acknowledgment_captured_at: new Date().toISOString(),
          acknowledgment_captured_by: req.user?.employeeId || req.user?.id || 'unknown',
        });

        // Sync to external API with acknowledgment
        // Note: The shipment status is NOT updated here yet (it happens in a separate call)
        // But we try to sync the acknowledgment immediately.
        externalSync.syncShipmentUpdate(shipment, acknowledgment)
          .then(async (success: boolean) => {
            if (success) {
              await storage.updateShipment(shipmentId, {
                shipment_id: shipmentId,
                synced_to_external: true,
                sync_status: 'synced',
                last_sync_attempt: new Date().toISOString(),
                sync_error: null
              });
            } else {
              await storage.updateShipment(shipmentId, {
                shipment_id: shipmentId,
                synced_to_external: false,
                sync_status: 'failed',
                last_sync_attempt: new Date().toISOString(),
                sync_error: 'External sync failed'
              });
            }
          })
          .catch(async (err: unknown) => {
            log.error('External sync failed for acknowledgment:', err);
            await storage.updateShipment(shipmentId, {
              shipment_id: shipmentId,
              synced_to_external: false,
              sync_status: 'failed',
              last_sync_attempt: new Date().toISOString(),
              sync_error: err instanceof Error ? err.message : String(err)
            });
          });

        res.status(200).json({
          success: true,
          message: 'Acknowledgment saved successfully',
          acknowledgment
        });

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Error saving acknowledgment:', errorMessage);
        res.status(500).json({
          success: false,
          message: 'Failed to save acknowledgment'
        });
      }
    }
  );
}
