import type { Express } from "express";
import { storage } from "../storage.js";
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import { log } from "../../shared/utils/logger.js";

export function registerRouteTrackingRoutes(app: Express): void {
  // Start a new route session
  app.post('/api/routes/start', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { startLatitude, startLongitude, shipmentId } = req.body;
      const employeeId = req.user?.employeeId;

      if (!employeeId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const sessionData = {
        id: 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        employeeId,
        startLatitude: parseFloat(startLatitude),
        startLongitude: parseFloat(startLongitude),
        shipmentId: shipmentId ? String(shipmentId) : undefined
      };

      const session = await storage.startRouteSession(sessionData);
      log.info('Route session started:', session);

      res.status(201).json({
        success: true,
        session,
        message: 'Route session started successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error starting route session:', message);
      res.status(500).json({
        success: false,
        message: 'Failed to start route session'
      });
    }
  });

  // Stop a route session
  app.post('/api/routes/stop', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, endLatitude, endLongitude } = req.body;

      const sessionData = {
        sessionId,
        endLatitude: parseFloat(endLatitude),
        endLongitude: parseFloat(endLongitude)
      };

      const session = await storage.stopRouteSession(sessionData);
      log.info('Route session stopped:', session);

      res.json({
        success: true,
        session,
        message: 'Route session stopped successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error stopping route session:', message);
      res.status(500).json({
        success: false,
        message: 'Failed to stop route session'
      });
    }
  });

  // Submit GPS coordinates
  app.post('/api/routes/coordinates', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, latitude, longitude, accuracy, speed, timestamp } = req.body;
      const employeeId = req.user?.employeeId;

      const coordinateData = {
        sessionId,
        employeeId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        speed: speed ? parseFloat(speed) : null,
        timestamp: timestamp || new Date().toISOString()
      };

      const record = await storage.recordCoordinate(coordinateData);
      log.debug('GPS coordinate recorded:', record);

      res.status(201).json({
        success: true,
        record,
        message: 'GPS coordinate recorded successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error recording GPS coordinate:', message);
      res.status(500).json({
        success: false,
        message: 'Failed to record GPS coordinate'
      });
    }
  });

  // Record shipment event (pickup/delivery) for a session
  app.post('/api/routes/shipment-event', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, shipmentId, eventType, latitude, longitude } = req.body || {};
      const employeeId = req.user?.employeeId;

      if (!employeeId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const record = await storage.recordShipmentEvent({
        sessionId,
        shipmentId,
        eventType,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        employeeId
      });

      log.info('Route shipment event recorded:', record);

      return res.status(201).json({
        success: true,
        record,
        message: 'Shipment event recorded and coordinates updated'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error recording shipment event:', message);
      return res.status(500).json({ success: false, message: 'Failed to record shipment event' });
    }
  });

  // Get session data
  app.get('/api/routes/session/:sessionId', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getRouteSession(sessionId);

      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }

      res.json({ success: true, session });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error fetching session:', message);
      res.status(500).json({ success: false, message: 'Failed to fetch session' });
    }
  });

  // Batch submit GPS coordinates (for offline sync)
  app.post('/api/routes/coordinates/batch', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { coordinates } = req.body;
      const employeeId = req.user?.employeeId;

      if (!Array.isArray(coordinates)) {
        return res.status(400).json({
          success: false,
          message: 'Coordinates must be an array'
        });
      }

      const results = await Promise.all(coordinates.map(async (coord: {
        sessionId: string;
        employeeId?: number;
        latitude: string | number;
        longitude: string | number;
        accuracy?: string | number;
        speed?: string | number;
        timestamp?: string;
      }) => {
        try {
          const record = await storage.recordCoordinate({
            sessionId: coord.sessionId,
            employeeId: employeeId || (coord.employeeId ? String(coord.employeeId) : undefined),
            latitude: parseFloat(String(coord.latitude)),
            longitude: parseFloat(String(coord.longitude)),
            timestamp: coord.timestamp || new Date().toISOString()
          });

          return { success: true, record };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log.error('Error processing coordinate:', message);
          return { success: false, error: message };
        }
      }));

      res.json({
        success: true,
        results,
        message: `Processed ${results.length} coordinates`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error processing batch coordinates:', message);
      res.status(500).json({
        success: false,
        message: 'Failed to process batch coordinates'
      });
    }
  });

  // Offline sync: sync a route session created while offline
  app.post('/api/routes/sync-session', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { id, endTime, status, startLatitude, startLongitude, endLatitude, endLongitude, shipmentId } = req.body || {};
      const employeeId = req.user?.employeeId;

      if (!employeeId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const session = await storage.startRouteSession({
        id,
        employeeId,
        startLatitude,
        startLongitude,
        shipmentId: shipmentId ? String(shipmentId) : undefined
      });

      if (status === 'completed' || endTime) {
        await storage.stopRouteSession({
          sessionId: id,
          endLatitude,
          endLongitude
        });
      }

      return res.json({ success: true, session, message: 'Session synced' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error syncing session:', message);
      return res.status(500).json({ success: false, message: 'Failed to sync session' });
    }
  });

  // Offline sync: sync coordinates captured while offline
  app.post('/api/routes/sync-coordinates', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, coordinates } = req.body || {};
      const employeeId = req.user?.employeeId;

      const results = await Promise.all((coordinates || []).map(async (coord: {
        sessionId: string;
        employeeId?: number;
        latitude: string | number;
        longitude: string | number;
        accuracy?: string | number;
        speed?: string | number;
        timestamp?: string;
      }) => {
        return await storage.recordCoordinate({
          sessionId,
          employeeId,
          latitude: parseFloat(String(coord.latitude)),
          longitude: parseFloat(String(coord.longitude)),
          timestamp: coord.timestamp
        });
      }));

      log.info(`Offline coordinates synced for session ${sessionId}:`, results.length);
      return res.json({ success: true, results, message: 'Coordinates synced' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Error syncing coordinates:', message);
      return res.status(500).json({ success: false, message: 'Failed to sync coordinates' });
    }
  });
}