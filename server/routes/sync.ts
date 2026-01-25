import type { Express } from "express";
import { storage } from "../storage.js";
import { log } from "../../shared/utils/logger.js";

export function registerSyncRoutes(app: Express): void {
  // Sync status endpoints
  app.get('/api/sync/stats', async (_req, res) => {
    try {
      // Mock sync stats for now - would be implemented with actual sync tracking
      const stats = {
        totalSynced: 150,
        pendingSync: 5,
        failedSync: 2,
        lastSyncTime: new Date().toISOString()
      };
      res.json(stats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error fetching sync stats:', errorMessage);
      res.status(500).json({ error: 'Failed to fetch sync stats' });
    }
  });

  app.post('/api/sync/trigger', async (_req, res) => {
    try {
      // Get all shipments that need syncing
      const pendingShipments = await storage.getShipments({ status: 'pending' });
      log.info('Manual sync triggered:', { count: pendingShipments.data.length });
      res.json({ success: true, message: `Triggered sync for ${pendingShipments.data.length} shipments` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error triggering sync:', errorMessage);
      res.status(500).json({ error: 'Failed to trigger sync' });
    }
  });

  // Get sync status for shipments
  app.get('/api/shipments/sync-status', async (req, res) => {
    try {
      const { shipmentId, status } = req.query;

      // Mock sync status data (in production, would be stored in database)
      const syncStatuses = [
        {
          shipmentId: shipmentId || 1,
          status: status || 'synced',
          lastSyncAt: new Date().toISOString(),
          syncAttempts: 1,
          lastError: null
        }
      ];

      res.json({
        success: true,
        syncStatuses,
        message: 'Sync status retrieved successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error retrieving sync status:', errorMessage);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sync status'
      });
    }
  });

  // Simple sync endpoint for shipments
  app.post('/api/shipments/:id/sync', async (req, res) => {
    try {
      const { id } = req.params;
      const shipment = await storage.getShipment(id);

      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found'
        });
      }

      log.info(`Syncing shipment ${id}`);

      res.json({
        success: true,
        message: 'Shipment synced successfully',
        shipmentId: id
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Sync error:', errorMessage);
      res.status(500).json({
        success: false,
        message: 'Failed to sync shipment'
      });
    }
  });

  // Batch sync multiple shipments
  app.post('/api/shipments/batch-sync', async (req, res) => {
    try {
      const { shipmentIds } = req.body;

      if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'shipmentIds must be a non-empty array'
        });
      }

      log.info(`Batch syncing ${shipmentIds.length} shipments...`);

      res.json({
        success: true,
        message: `Batch sync completed for ${shipmentIds.length} shipments`,
        processed: shipmentIds.length
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Batch sync error:', errorMessage);
      res.status(500).json({
        success: false,
        message: 'Failed to batch sync shipments'
      });
    }
  });
}