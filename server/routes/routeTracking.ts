import type { Express } from "express";
import { log } from "../../shared/utils/logger.js";

export function registerRouteTrackingRoutes(app: Express): void {
  // Start a new route session
  app.post('/api/routes/start', async (req, res) => {
    try {
      const { employeeId, startLatitude, startLongitude, shipmentId } = req.body;

      const session = {
        id: Date.now().toString(),
        employeeId,
        startTime: new Date().toISOString(),
        status: 'active',
        startLatitude: parseFloat(startLatitude),
        startLongitude: parseFloat(startLongitude),
        shipmentId: shipmentId ? parseInt(shipmentId) : null
      };

      // Store session (in production, this would use proper database storage)
      log.info('Route session started:', session);

      res.status(201).json({
        success: true,
        session,
        message: 'Route session started successfully'
      });
    } catch (error: any) {
      log.error('Error starting route session:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to start route session'
      });
    }
  });

  // Stop a route session
  app.post('/api/routes/stop', async (req, res) => {
    try {
      const { sessionId, endLatitude, endLongitude } = req.body;

      const session = {
        id: sessionId,
        endTime: new Date().toISOString(),
        status: 'completed',
        endLatitude: parseFloat(endLatitude),
        endLongitude: parseFloat(endLongitude)
      };

      // Update session (in production, this would use proper database storage)
      log.info('Route session stopped:', session);

      res.json({
        success: true,
        session,
        message: 'Route session stopped successfully'
      });
    } catch (error: any) {
      log.error('Error stopping route session:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to stop route session'
      });
    }
  });

  // Submit GPS coordinates
  app.post('/api/routes/coordinates', async (req, res) => {
    try {
      const { sessionId, latitude, longitude, accuracy, speed, timestamp } = req.body;

      const coordinate = {
        sessionId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        speed: speed ? parseFloat(speed) : null,
        timestamp: timestamp || new Date().toISOString()
      };

      // Store coordinate (in production, this would use proper database storage)
      log.debug('GPS coordinate recorded:', coordinate);

      res.status(201).json({
        success: true,
        coordinate,
        message: 'GPS coordinate recorded successfully'
      });
    } catch (error: any) {
      log.error('Error recording GPS coordinate:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to record GPS coordinate'
      });
    }
  });

  // Record shipment event (pickup/delivery) for a session
  app.post('/api/routes/shipment-event', async (req, res) => {
    try {
      const { sessionId, shipmentId, eventType, latitude, longitude } = req.body || {};

      const record = {
        sessionId,
        shipmentId: parseInt(shipmentId),
        eventType,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date().toISOString()
      };

      log.info('Route shipment event recorded:', record);

      return res.status(201).json({ success: true, record, message: 'Shipment event recorded' });
    } catch (error: any) {
      log.error('Error recording shipment event:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to record shipment event' });
    }
  });

  // Get session data
  app.get('/api/routes/session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Mock session data (in production, would fetch from database)
      const session = {
        id: sessionId,
        employeeId: 'mock-employee',
        status: 'active',
        startTime: new Date().toISOString()
      };

      res.json({ success: true, session });
    } catch (error: any) {
      log.error('Error fetching session:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch session' });
    }
  });

  // Batch submit GPS coordinates (for offline sync)
  app.post('/api/routes/coordinates/batch', async (req, res) => {
    try {
      const { coordinates } = req.body;

      if (!Array.isArray(coordinates)) {
        return res.status(400).json({
          success: false,
          message: 'Coordinates must be an array'
        });
      }

      const results = coordinates.map((coord: any) => {
        try {
          const coordinate = {
            sessionId: coord.sessionId,
            latitude: parseFloat(coord.latitude),
            longitude: parseFloat(coord.longitude),
            accuracy: coord.accuracy ? parseFloat(coord.accuracy) : null,
            speed: coord.speed ? parseFloat(coord.speed) : null,
            timestamp: coord.timestamp || new Date().toISOString()
          };

          // Store coordinate (in production, this would use proper database storage)
          log.debug('Batch GPS coordinate recorded:', coordinate);

          return { success: true, record: coordinate };
        } catch (error: any) {
          log.error('Error processing coordinate:', error.message);
          return { success: false, error: error.message };
        }
      });

      res.json({
        success: true,
        results,
        message: `Processed ${results.length} coordinates`
      });
    } catch (error: any) {
      log.error('Error processing batch coordinates:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to process batch coordinates'
      });
    }
  });

  // Offline sync: sync a route session created while offline
  app.post('/api/routes/sync-session', async (req, res) => {
    try {
      const { id, employeeId, startTime, endTime, status, startLatitude, startLongitude, endLatitude, endLongitude } = req.body || {};

      const synced = {
        id,
        employeeId,
        startTime,
        endTime,
        status,
        startLatitude: startLatitude ? parseFloat(startLatitude) : null,
        startLongitude: startLongitude ? parseFloat(startLongitude) : null,
        endLatitude: endLatitude ? parseFloat(endLatitude) : null,
        endLongitude: endLongitude ? parseFloat(endLongitude) : null,
        syncedAt: new Date().toISOString()
      };

      log.info('Offline session synced:', synced);
      return res.json({ success: true, session: synced, message: 'Session synced' });
    } catch (error: any) {
      log.error('Error syncing session:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to sync session' });
    }
  });

  // Offline sync: sync coordinates captured while offline
  app.post('/api/routes/sync-coordinates', async (req, res) => {
    try {
      const { sessionId, coordinates } = req.body || {};

      const results = (coordinates || []).map((coord: any) => ({
        sessionId,
        latitude: parseFloat(coord.latitude),
        longitude: parseFloat(coord.longitude),
        accuracy: coord.accuracy ? parseFloat(coord.accuracy) : null,
        speed: coord.speed ? parseFloat(coord.speed) : null,
        timestamp: coord.timestamp,
        syncedAt: new Date().toISOString()
      }));

      log.info(`Offline coordinates synced for session ${sessionId}:`, results.length);
      return res.json({ success: true, results, message: 'Coordinates synced' });
    } catch (error: any) {
      log.error('Error syncing coordinates:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to sync coordinates' });
    }
  });
}