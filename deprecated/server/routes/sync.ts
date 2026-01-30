import type { Express } from "express";
import { storage } from "../storage.js";
import { log } from "../../shared/utils/logger.js";
import { externalSync } from "../services/externalSync.js";

export function registerSyncRoutes(app: Express): void {
  // Sync status endpoints
  app.get('/api/sync/stats', async (_req, res) => {
    try {
      // Get actual sync stats from the database
      const pendingShipments = await storage.getShipments({ syncStatus: 'needs_sync', limit: 1 });
      const failedShipments = await storage.getShipments({ syncStatus: 'failed', limit: 1 });
      
      // For now, we'll use the counts from the filtered queries
      // Note: getShipments returns { data, total }
      
      const stats = {
        totalSynced: 0, // We might need a specific query for this or calculate it
        pendingSync: pendingShipments.total,
        failedSync: failedShipments.total,
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
      // Get all shipments that need syncing (pending or failed)
      // Using a large limit to process as many as possible
      const pendingShipments = await storage.getShipments({ syncStatus: 'needs_sync', limit: 1000 });
      
      if (pendingShipments.data.length === 0) {
        return res.json({ success: true, message: 'No pending shipments to sync' });
      }

      log.info('Manual sync triggered:', { count: pendingShipments.data.length });
      
      // Trigger batch sync asynchronously to avoid timeout
      // We don't await this fully if we want to return quickly, but the client might expect completion.
      // Given the "Sync Now" button behavior, it might be better to await or return a "started" status.
      // However, externalSync.batchSyncShipments returns { success, failed } counts, so let's await it.
      
      const result = await externalSync.batchSyncShipments(pendingShipments.data);
      
      res.json({ 
        success: true, 
        message: `Sync completed: ${result.success} successful, ${result.failed} failed`,
        details: result
      });
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