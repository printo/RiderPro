import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage.js";
import {
  insertShipmentSchema,
  updateShipmentSchema,
  batchUpdateSchema,
  insertAcknowledgmentSchema,
  shipmentFiltersSchema,
  startRouteSessionSchema,
  stopRouteSessionSchema,
  gpsCoordinateSchema,
  routeFiltersSchema,
  ShipmentFilters
} from "@shared/schema";
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

  // Get shipments with optional filters, pagination, and sorting
  app.get('/api/shipments', async (req, res) => {
    try {
      // Get the authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header is required' });
      }

      // Extract the token
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      // In a real app, you would verify the JWT token here and get the user
      // For now, we'll use a mock function to simulate getting the user from the token
      const user = await getUserFromToken(token);
      if (!user || !user.employeeId) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      // Convert query parameters to filters
      const filters: ShipmentFilters = {};
      
      // Safely copy valid filter fields from query
      const validFilters = ['status', 'priority', 'type', 'routeName', 'date', 'search', 'employeeId'];
      
      // Handle string filters
      for (const [key, value] of Object.entries(req.query)) {
        if (validFilters.includes(key) && typeof value === 'string') {
          (filters as any)[key] = value;
        }
      }
      
      // Handle date range if present
      if (req.query.dateRange) {
        try {
          const dateRange = typeof req.query.dateRange === 'string' 
            ? JSON.parse(req.query.dateRange) 
            : req.query.dateRange;
            
          if (dateRange && typeof dateRange === 'object' && 'start' in dateRange && 'end' in dateRange) {
            filters.dateRange = {
              start: String(dateRange.start),
              end: String(dateRange.end)
            };
          }
        } catch (e) {
          console.warn('Invalid dateRange format:', req.query.dateRange);
        }
      }
      
      // Handle pagination with type safety
      if (req.query.page) {
        const page = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
        filters.page = typeof page === 'string' ? parseInt(page, 10) : 1;
      }
      
      if (req.query.limit) {
        const limit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        filters.limit = typeof limit === 'string' ? parseInt(limit, 10) : 20;
      }
      
      // Handle sorting with type safety
      if (req.query.sortField) {
        const sortField = Array.isArray(req.query.sortField) ? req.query.sortField[0] : req.query.sortField;
        if (typeof sortField === 'string') {
          filters.sortField = sortField;
        }
      }
      
      if (req.query.sortOrder) {
        const sortOrder = Array.isArray(req.query.sortOrder) ? req.query.sortOrder[0] : req.query.sortOrder;
        if (typeof sortOrder === 'string' && (sortOrder.toUpperCase() === 'ASC' || sortOrder.toUpperCase() === 'DESC')) {
          filters.sortOrder = sortOrder.toUpperCase() as 'ASC' | 'DESC';
        }
      }
      
      // If the user is not an admin, filter by their employee ID
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        filters.employeeId = user.employeeId;
      }
      
      // Set cache control headers (5 minutes)
      res.set('Cache-Control', 'public, max-age=300');
      
      // Get shipments with pagination
      const { data: shipments, total } = await storage.getShipments(filters);
      
      // Add pagination headers
      const page = Math.max(1, parseInt(filters.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit as string) || 20));
      const totalPages = Math.ceil(total / limit);
      
      res.set({
        'X-Total-Count': total,
        'X-Total-Pages': totalPages,
        'X-Current-Page': page,
        'X-Per-Page': limit,
        'X-Has-Next-Page': page < totalPages,
        'X-Has-Previous-Page': page > 1
      });
      
      res.json(shipments);
    } catch (error: any) {
      console.error('Error fetching shipments:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch shipments' });
    }
  });
  
  // Mock function to get user from token - replace with your actual JWT verification
  async function getUserFromToken(token: string): Promise<{ employeeId: string; role: string } | null> {
    try {
      // In a real app, you would verify the JWT token here
      // This is just a mock implementation
      const authHeader = `Bearer ${token}`;
      const response = await fetch('https://pia.printo.in/api/v1/auth/me/', {
        headers: { 'Authorization': authHeader }
      });
      
      if (!response.ok) {
        console.error('Failed to verify token:', await response.text());
        return null;
      }
      
      const userData = await response.json();
      return {
        employeeId: userData.employee_id || userData.username,
        role: userData.is_superuser ? 'admin' : 'user'
      };
    } catch (error) {
      console.error('Error verifying token:', error);
      return null;
    }
  }

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

      // Get current shipment to check type
      const currentShipment = await storage.getShipment(req.params.id);
      if (!currentShipment) {
        return res.status(404).json({ message: 'Shipment not found' });
      }

      // Validate status update based on shipment type
      if (updates.status === "Delivered" && currentShipment.type !== "delivery") {
        return res.status(400).json({ message: 'Cannot mark a pickup shipment as Delivered' });
      }
      if (updates.status === "Picked Up" && currentShipment.type !== "pickup") {
        return res.status(400).json({ message: 'Cannot mark a delivery shipment as Picked Up' });
      }

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

      // Validate each update in the batch
      for (const update of batchData.updates) {
        const shipment = await storage.getShipment(update.id);
        if (!shipment) {
          return res.status(400).json({ message: `Shipment ${update.id} not found` });
        }

        // Validate status update based on shipment type
        if (update.status === "Delivered" && shipment.type !== "delivery") {
          return res.status(400).json({ message: `Cannot mark pickup shipment ${update.id} as Delivered` });
        }
        if (update.status === "Picked Up" && shipment.type !== "pickup") {
          return res.status(400).json({ message: `Cannot mark delivery shipment ${update.id} as Picked Up` });
        }
      }

      const updatedCount = await storage.batchUpdateShipments(batchData);

      // Get updated shipments for external sync
      const updatedShipments = await Promise.all(
        batchData.updates.map(async (update: any) => {
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
            const filename = await saveBase64File(signatureData, 'signature');
            signatureUrl = getFileUrl(filename, 'signature');
          } catch (error) {
            console.error('Failed to save signature data:', error);
          }
        }

        // Create acknowledgment record
        const acknowledgment = await storage.createAcknowledgment({
          shipmentId,
          signature: signatureUrl,
          photo: photoUrl,
          timestamp: new Date().toISOString(),
          recipientName: req.body.recipientName || 'Unknown',
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
      const { data: shipments } = await storage.getShipments({});
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

  // Route Tracking Endpoints

  // Start a new route session
  app.post('/api/routes/start', async (req, res) => {
    try {
      const { employeeId, startLatitude, startLongitude, shipmentId } = req.body;

      if (!employeeId || !startLatitude || !startLongitude) {
        return res.status(400).json({
          success: false,
          message: 'employeeId, startLatitude, and startLongitude are required'
        });
      }

      const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const session = {
        id: sessionId,
        employeeId,
        shipmentId: shipmentId || null,
        status: 'active',
        startTime: new Date().toISOString(),
        startLatitude,
        startLongitude,
        endTime: null,
        endLatitude: null,
        endLongitude: null
      };

      // Store session (in production, this would use proper database storage)
      console.log('Route session started:', session);

      res.status(201).json({
        success: true,
        session,
        message: 'Route session started successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  });

  // Stop a route session
  app.post('/api/routes/stop', async (req, res) => {
    try {
      const { sessionId, endLatitude, endLongitude } = req.body;

      if (!sessionId || !endLatitude || !endLongitude) {
        return res.status(400).json({
          success: false,
          message: 'sessionId, endLatitude, and endLongitude are required'
        });
      }

      const session = {
        id: sessionId,
        status: 'completed',
        endTime: new Date().toISOString(),
        endLatitude,
        endLongitude
      };

      // Update session (in production, this would use proper database storage)
      console.log('Route session stopped:', session);

      res.json({
        success: true,
        session,
        message: 'Route session stopped successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  });

  // Submit GPS coordinates
  app.post('/api/routes/coordinates', async (req, res) => {
    try {
      const { sessionId, latitude, longitude, accuracy, speed, timestamp } = req.body;

      if (!sessionId || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'sessionId, latitude, and longitude are required'
        });
      }

      const coordinate = {
        id: 'coord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        sessionId,
        latitude,
        longitude,
        accuracy: accuracy || null,
        speed: speed || null,
        timestamp: timestamp || new Date().toISOString()
      };

      // Store coordinate (in production, this would use proper database storage)
      console.log('GPS coordinate recorded:', coordinate);

      res.status(201).json({
        success: true,
        record: coordinate,
        message: 'GPS coordinate recorded successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  });

  // Get session data
  app.get('/api/routes/session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Mock session data (in production, this would query the database)
      const session = {
        id: sessionId,
        employeeId: 'mock-employee',
        status: 'active',
        startTime: new Date().toISOString(),
        coordinates: []
      };

      res.json({
        success: true,
        session,
        message: 'Session data retrieved successfully'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // Batch submit GPS coordinates (for offline sync)
  app.post('/api/routes/coordinates/batch', async (req, res) => {
    try {
      const { coordinates } = req.body;

      if (!Array.isArray(coordinates)) {
        return res.status(400).json({
          success: false,
          message: 'coordinates must be an array'
        });
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const coord of coordinates) {
        try {
          const coordinate = {
            id: 'coord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ...coord,
            timestamp: coord.timestamp || new Date().toISOString()
          };

          // Store coordinate (in production, this would use proper database storage)
          console.log('Batch GPS coordinate recorded:', coordinate);

          results.push({ success: true, record: coordinate });
          successCount++;
        } catch (error: any) {
          results.push({ success: false, error: error.message, coordinate: coord });
          errorCount++;
        }
      }

      res.json({
        success: true,
        results,
        summary: {
          total: coordinates.length,
          successful: successCount,
          failed: errorCount
        },
        message: `Batch coordinate submission completed: ${successCount} successful, ${errorCount} failed`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
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
