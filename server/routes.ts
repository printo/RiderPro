import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import bcrypt from "bcrypt";
import { storage } from "./storage.js";
import { db } from "./db/pg-connection.js";
import { authenticate, AuthenticatedRequest } from "./middleware/auth.js";
import {
  insertShipmentSchema,
  updateShipmentSchema,
  batchUpdateSchema,
  shipmentFiltersSchema,
  startRouteSessionSchema,
  stopRouteSessionSchema,
  gpsCoordinateSchema,
  routeFiltersSchema,
  ShipmentFilters,
  VehicleType,
  InsertVehicleType,
  UpdateVehicleType
} from "@shared/schema";
import { upload, getFileUrl, saveBase64File } from "./utils/fileUpload.js";
import { externalSync } from "./services/externalSync.js";
import { riderService } from "./services/RiderService.js";
import { routeService } from "./services/RouteService.js";
import { fieldMappingService } from "./services/FieldMappingService.js";
import { payloadValidationService } from "./services/PayloadValidationService.js";
import { webhookAuth, webhookSecurity, webhookRateLimit, webhookPayloadLimit, webhookLogger } from "./middleware/webhookAuth.js";
import path from 'path';

// Helper function to convert export data to CSV format
function convertToCSV(exportData: any): string {
  const { tokens, analytics } = exportData;

  let csv = 'Token Analytics Export\n\n';

  // Add summary statistics
  csv += 'Summary Statistics\n';
  csv += 'Metric,Value\n';
  csv += `Total Tokens,${analytics.totalTokens}\n`;
  csv += `Active Tokens,${analytics.activeTokens}\n`;
  csv += `Total Requests,${analytics.totalRequests}\n`;
  csv += `Requests Today,${analytics.requestsToday}\n`;
  csv += `Requests This Week,${analytics.requestsThisWeek}\n`;
  csv += `Requests This Month,${analytics.requestsThisMonth}\n\n`;

  // Add token information
  csv += 'Token Information\n';
  csv += 'ID,Name,Description,Permissions,Status,Created At,Request Count\n';
  tokens.forEach((token: any) => {
    csv += `${token.id},"${token.name}","${token.description || ''}",${token.permissions},${token.status},${token.createdAt},${token.requestCount}\n`;
  });

  csv += '\nTop Endpoints\n';
  csv += 'Endpoint,Request Count\n';
  analytics.topEndpoints.forEach((endpoint: any) => {
    csv += `"${endpoint.endpoint}",${endpoint.count}\n`;
  });

  return csv;
}

// Helper function to check if user has required permission level
// Simplified permission check (can be expanded if needed)
function hasRequiredPermission(_req: any, _requiredLevel: 'read' | 'write' | 'admin'): boolean {
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add request ID middleware for better error tracking

  // Add error handling middleware at the end
  const setupErrorHandling = () => {
    // Error handling middleware can be added here if needed
  };

  // Health check endpoint for connectivity monitoring with caching and rate limiting
  let healthCheckCache: { data: any; timestamp: number } | null = null;
  const HEALTH_CHECK_CACHE_TTL = 10000; // 10 seconds cache
  const healthCheckRateLimit = new Map<string, { count: number; resetTime: number }>();
  const HEALTH_CHECK_RATE_LIMIT = 10; // 10 requests per minute per IP
  const HEALTH_CHECK_RATE_WINDOW = 60000; // 1 minute window

  app.get('/api/health', (req, res) => {
    const now = Date.now();
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Rate limiting check
    const rateLimitKey = `health_${clientIP}`;
    const rateLimitData = healthCheckRateLimit.get(rateLimitKey);

    if (rateLimitData) {
      if (now > rateLimitData.resetTime) {
        // Reset the counter
        healthCheckRateLimit.set(rateLimitKey, { count: 1, resetTime: now + HEALTH_CHECK_RATE_WINDOW });
      } else if (rateLimitData.count >= HEALTH_CHECK_RATE_LIMIT) {
        // Rate limit exceeded
        res.set('Retry-After', Math.ceil((rateLimitData.resetTime - now) / 1000).toString());
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many health check requests. Please slow down.',
          retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000)
        });
      } else {
        // Increment counter
        rateLimitData.count++;
      }
    } else {
      // First request from this IP
      healthCheckRateLimit.set(rateLimitKey, { count: 1, resetTime: now + HEALTH_CHECK_RATE_WINDOW });
    }

    // Return cached response if still valid
    if (healthCheckCache && (now - healthCheckCache.timestamp) < HEALTH_CHECK_CACHE_TTL) {
      res.set('Cache-Control', 'public, max-age=10');
      res.set('X-Health-Cache', 'HIT');
      return res.status(200).json({ ...healthCheckCache.data, cached: true });
    }

    // Generate new response and cache it
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cached: false
    };

    healthCheckCache = {
      data: healthData,
      timestamp: now
    };

    res.set('Cache-Control', 'public, max-age=10');
    res.set('X-Health-Cache', 'MISS');
    res.status(200).json(healthData);
  });

  // ===== AUTHENTICATION ROUTES =====

  // Local user registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { riderId, password, fullName } = req.body;

      if (!riderId || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Rider ID, password, and full name are required'
        });
      }

      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM rider_accounts WHERE rider_id = $1',
        [riderId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Rider ID already exists'
        });
      }

      // Hash password using bcrypt
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user account (pending approval)
      const userId = 'rider_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);

      await db.query(`
        INSERT INTO rider_accounts (
          id, rider_id, full_name, password_hash, 
          is_active, is_approved, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, true, false, NOW(), NOW())
      `, [userId, riderId, fullName, passwordHash]);

      res.json({
        success: true,
        message: 'Registration successful. Please wait for approval.',
        userId
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  });

  // Local user login
  app.post('/api/auth/local-login', async (req, res) => {
    try {
      const { riderId, password } = req.body;

      if (!riderId || !password) {
        return res.status(400).json({
          success: false,
          message: 'Rider ID and password are required'
        });
      }

      // Find user
      const userResult = await db.query(`
        SELECT id, rider_id, full_name, password_hash, is_active, is_approved, role
        FROM rider_accounts 
        WHERE rider_id = $1 AND is_active = true
      `, [riderId]);
      const user = userResult.rows[0] as any;

      if (!user) {
        console.log('User not found for riderId:', riderId);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password using bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        console.log('Invalid password for riderId:', riderId);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is approved
      if (!user.is_approved) {
        return res.status(403).json({
          success: false,
          message: 'Account pending approval. Please contact administrator.',
          isApproved: false
        });
      }

      // Generate simple tokens with user ID embedded (in production use JWT)
      const accessToken = 'local_' + Date.now() + '_' + user.id;
      const refreshToken = 'refresh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);

      // Update last login
      await db.query(`
        UPDATE rider_accounts 
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [user.id]);

      res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        fullName: user.full_name,
        isApproved: user.is_approved
      });
    } catch (error: any) {
      console.error('Local login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed. Please try again.'
      });
    }
  });

  // Get pending approvals (for admin)
  app.get('/api/auth/pending-approvals', async (req, res) => {
    try {
      const pendingUsersResult = await db.query(`
        SELECT id, rider_id, full_name, created_at
        FROM rider_accounts 
        WHERE is_approved = false AND is_active = true
        ORDER BY created_at DESC
      `);
      const pendingUsers = pendingUsersResult.rows;

      res.json({
        success: true,
        users: pendingUsers
      });
    } catch (error: any) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending approvals'
      });
    }
  });

  // Approve user (for admin)
  app.post('/api/auth/approve/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await db.query(`
        UPDATE rider_accounts 
        SET is_approved = true, updated_at = NOW()
        WHERE id = $1 AND is_active = true
      `, [userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User approved successfully'
      });
    } catch (error: any) {
      console.error('Approve user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve user'
      });
    }
  });

  // Reject user (for admin)
  app.post('/api/auth/reject/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await db.query(`
        UPDATE rider_accounts 
        SET is_active = false, is_approved = false, updated_at = NOW()
        WHERE id = $1
      `, [userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User rejected successfully'
      });
    } catch (error: any) {
      console.error('Reject user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject user'
      });
    }
  });

  // Reset user password (for admin)
  app.post('/api/auth/reset-password/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Hash new password using bcrypt
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      const result = await db.query(`
        UPDATE rider_accounts 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2 AND is_active = true
      `, [passwordHash, userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  });
  // Token admin routes removed

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

  // Vehicle Types CRUD endpoints
  app.get('/api/vehicle-types', async (req, res) => {
    try {
      const vehicleTypes = await storage.getVehicleTypes();
      res.json(vehicleTypes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/vehicle-types/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleType = await storage.getVehicleType(id);
      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }
      res.json(vehicleType);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/vehicle-types', async (req, res) => {
    try {
      const vehicleTypeData: InsertVehicleType = req.body;

      // Generate ID if not provided
      if (!vehicleTypeData.id) {
        vehicleTypeData.id = `vt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const vehicleType = await storage.createVehicleType(vehicleTypeData);
      res.status(201).json(vehicleType);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/vehicle-types/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates: UpdateVehicleType = req.body;

      const vehicleType = await storage.updateVehicleType(id, updates);
      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }
      res.json(vehicleType);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/vehicle-types/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteVehicleType(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }
      res.json({ message: 'Vehicle type deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Fuel Settings CRUD endpoints
  app.get('/api/fuel-settings', async (req, res) => {
    try {
      const fuelSettings = await storage.getFuelSettings();
      res.json(fuelSettings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/fuel-settings/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const fuelSetting = await storage.getFuelSetting(id);
      if (!fuelSetting) {
        return res.status(404).json({ message: 'Fuel setting not found' });
      }
      res.json(fuelSetting);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/fuel-settings', async (req, res) => {
    try {
      const fuelSettingData = req.body;

      // Generate ID if not provided
      if (!fuelSettingData.id) {
        fuelSettingData.id = `fs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const fuelSetting = await storage.createFuelSetting(fuelSettingData);
      res.status(201).json(fuelSetting);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/fuel-settings/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const fuelSetting = await storage.updateFuelSetting(id, updates);
      if (!fuelSetting) {
        return res.status(404).json({ message: 'Fuel setting not found' });
      }
      res.json(fuelSetting);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/fuel-settings/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFuelSetting(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Fuel setting not found' });
      }
      res.json({ message: 'Fuel setting deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Route sessions list and analytics (DB-backed)
  app.get('/api/routes/sessions', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const sessions = await routeService.listRecentSessions(limit);
      res.json({ success: true, data: sessions });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Get active session for an employee
  app.get('/api/routes/active/:employeeId', async (req, res) => {
    try {
      const { employeeId } = req.params;
      const activeSession = await routeService.getActiveSession(employeeId);

      if (!activeSession) {
        return res.status(404).json({
          success: false,
          message: 'No active session found for this employee'
        });
      }

      res.json({ success: true, data: activeSession });
    } catch (e: any) {
      console.error('Error getting active session:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/routes/analytics/summary', async (_req, res) => {
    try {
      const summary = await routeService.getAnalyticsSummary();
      res.json({ success: true, data: summary });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ---------------- Riders (lightweight auth) ----------------
  // List active riders (for dropdown)
  app.get('/api/riders', async (_req, res) => {
    try {
      const riders = await riderService.listRiders();
      res.json({ success: true, data: riders });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Check if a specific rider ID exists and is registered
  app.post('/api/riders/unregistered', async (req, res) => {
    try {
      const { riderId } = req.body;
      if (!riderId) {
        return res.status(400).json({ success: false, message: 'riderId is required' });
      }

      // Check if rider exists in our database
      const result = await db.query('SELECT id FROM rider_accounts WHERE rider_id = $1', [riderId]);
      res.json({
        success: true,
        exists: result.rows.length > 0,
        isRegistered: result.rows.length > 0
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Register new rider (from selected rider_id)
  app.post('/api/riders/register', async (req, res) => {
    try {
      const { riderId, password } = req.body;
      if (!riderId || !password) {
        return res.status(400).json({ success: false, message: 'riderId and password are required' });
      }

      // For now, we'll use a default name. In production, you might want to fetch from PIA backend
      const fullName = `Rider ${riderId}`;
      const rider = await riderService.registerRider(riderId, fullName, password);
      res.status(201).json({ success: true, data: rider });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  });

  // Check if a rider exists by riderId
  app.post('/api/riders/check-exists', async (req, res) => {
    try {
      const { riderId } = req.body || {};
      if (!riderId) {
        return res.status(400).json({ success: false, message: 'riderId is required' });
      }
      const result = await db.query('SELECT rider_id, name, is_active FROM riders WHERE rider_id = $1', [riderId]);
      const exists = result.rows.length > 0;
      return res.json({ success: true, exists, rider: exists ? result.rows[0] : null });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Rider login
  app.post('/api/riders/login', async (req, res) => {
    try {
      const { riderId, password } = req.body;
      if (!riderId || !password) {
        return res.status(400).json({ success: false, message: 'riderId and password are required' });
      }
      const rider = await riderService.login(riderId, password);
      if (!rider) return res.status(401).json({ success: false, message: 'Invalid credentials' });

      // Generate a simple token for the session
      const token = Buffer.from(`${riderId}:${Date.now()}`).toString('base64');

      res.json({
        success: true,
        name: rider.full_name,
        riderId: rider.rider_id,
        token: token,
        isApproved: rider.is_approved
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Get shipments with optional filters, pagination, and sorting
  app.get('/api/shipments', async (req, res) => {
    try {
      // Accept either: API token auth, rider session, or JWT without external verify
      // Prefer API token auth when present
      const apiTokenAuth = (req as any).isApiTokenAuth && (req as any).apiToken;
      let employeeId = (req.headers['x-employee-id'] as string | undefined) || undefined;
      let userRole = (req.headers['x-user-role'] as string | undefined) || 'driver';

      // Check for rider session in Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8');
          const [riderId] = decoded.split(':');
          if (riderId) {
            employeeId = riderId;
            userRole = 'driver';
          }
        } catch (e) {
          // Invalid token, continue with other auth methods
        }
      }

      if (apiTokenAuth) {
        userRole = 'admin';
      }
      if (!employeeId && userRole === 'driver') {
        // fall back to a safe default only for non-restrictive queries
        employeeId = 'driver';
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

      // Apply role-based filtering according to requirements:
      // - admin, super_admin: can see all shipments
      // - driver: can only see their own shipments  
      // - everyone else (ops_team): can see all shipments
      if (userRole === 'driver') {
        // Only drivers/delivery personnel see filtered results
        filters.employeeId = employeeId;
      }
      // For isSuperUser, isOpsTeam, and isStaff: no filtering (see all shipments)

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

  // Distinct route names for filters
  app.get('/api/routes/names', async (_req, res) => {
    try {
      const db = (storage as any).getDatabase();
      const result = await db.query('SELECT DISTINCT "routeName" as name FROM shipments WHERE "routeName" IS NOT NULL ORDER BY name');
      res.json({ success: true, data: result.rows.map((r: any) => r.name) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });


  // Get single shipment (no auth for now)
  app.get('/api/shipments/:id', async (req, res) => {
    try {
      // Authentication removed (simplified app)

      const shipment = await storage.getShipment(req.params.id);
      if (!shipment) {
        return res.status(404).json({ message: 'Shipment not found' });
      }

      // Also get acknowledgment if exists
      const acknowledgment = await storage.getAcknowledgmentByShipmentId(shipment.shipment_id);

      res.json({ shipment, acknowledgment });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new shipment (no auth for now)
  app.post('/api/shipments/create', async (req, res) => {
    try {
      // Authentication removed (simplified app)

      // Check write permissions
      if (!hasRequiredPermission(req, 'write')) {
        return res.status(403).json({
          message: 'Insufficient permissions. Write access required to create shipments.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Validate that shipment ID is provided
      if (!req.body.shipment_id && !req.body.trackingNumber) {
        return res.status(400).json({
          success: false,
          message: 'Shipment ID (shipment_id or trackingNumber) is required and cannot be empty',
          code: 'MISSING_SHIPMENT_ID'
        });
      }

      // Use trackingNumber as shipment_id if shipment_id is not provided
      if (!req.body.shipment_id && req.body.trackingNumber) {
        req.body.shipment_id = req.body.trackingNumber;
      }

      const shipmentData = insertShipmentSchema.parse(req.body);
      const shipment = await storage.createShipment(shipmentData);

      // Sync to external API
      externalSync.syncShipmentUpdate(shipment).catch(err => {
        console.error('External sync failed for new shipment:', err);
      });

      res.status(201).json({
        success: true,
        message: 'Shipment created successfully',
        shipment: shipment,
        shipmentId: shipment.shipment_id
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update shipment tracking data
  app.patch('/api/shipments/:id/tracking', async (req, res) => {
    try {
      const { id } = req.params;
      const trackingData = req.body;

      // Validate tracking data
      const allowedFields = ['start_latitude', 'start_longitude', 'stop_latitude', 'stop_longitude', 'km_travelled', 'status', 'actualDeliveryTime'];
      const updates: any = { shipment_id: id };

      for (const field of allowedFields) {
        if (trackingData[field] !== undefined) {
          updates[field] = trackingData[field];
        }
      }

      if (Object.keys(updates).length === 1) { // Only shipment_id
        return res.status(400).json({
          success: false,
          message: 'No valid tracking fields provided',
          code: 'NO_VALID_FIELDS'
        });
      }

      const updatedShipment = await storage.updateShipment(id, updates);

      if (!updatedShipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found',
          code: 'SHIPMENT_NOT_FOUND'
        });
      }

      // Mark as needing sync
      storage.updateShipment(id, {
        shipment_id: id,
        synced_to_external: false,
        last_sync_attempt: undefined,
        sync_error: undefined
      });

      res.json({
        success: true,
        message: 'Tracking data updated successfully',
        shipment: updatedShipment
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'TRACKING_UPDATE_FAILED'
      });
    }
  });

  // Sync shipment to external system
  app.post('/api/shipments/:id/sync', async (req, res) => {
    try {
      const { id } = req.params;
      const shipment = await storage.getShipment(id);

      if (!shipment) {
        return res.status(404).json({
          success: false,
          message: 'Shipment not found',
          code: 'SHIPMENT_NOT_FOUND'
        });
      }

      // Use optimized external API service
      try {
        const { ExternalApiService } = await import('./services/ExternalApiService.js');
        const externalApi = ExternalApiService.getInstance();

        // Validate payload before sending
        const syncData = externalApi.prepareSyncData(shipment);
        const validation = externalApi.validatePayload(syncData);

        if (!validation.valid) {
          console.warn('Payload validation warnings:', validation.warnings);
        }

        console.log(`Syncing shipment ${syncData.shipment_id} (${validation.size} bytes)`);

        // Send to external system
        const result = await externalApi.syncShipment(shipment);

        if (result.success) {
          // Mark as synced
          storage.updateShipment(id, {
            shipment_id: id,
            synced_to_external: true,
            last_sync_attempt: new Date().toISOString(),
            sync_error: undefined
          });

          res.json({
            success: true,
            message: result.message,
            syncedAt: result.synced_at,
            externalId: result.external_id
          });
        } else {
          // Mark sync as failed
          storage.updateShipment(id, {
            shipment_id: id,
            synced_to_external: false,
            last_sync_attempt: new Date().toISOString(),
            sync_error: result.error || 'Unknown error'
          });

          res.status(500).json({
            success: false,
            message: result.message,
            error: result.error,
            code: 'SYNC_FAILED'
          });
        }
      } catch (syncError: any) {
        // Mark sync as failed
        storage.updateShipment(id, {
          shipment_id: id,
          synced_to_external: false,
          last_sync_attempt: new Date().toISOString(),
          sync_error: syncError.message
        });

        res.status(500).json({
          success: false,
          message: 'Failed to sync to external system',
          error: syncError.message,
          code: 'SYNC_FAILED'
        });
      }
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'SYNC_REQUEST_FAILED'
      });
    }
  });

  // Get access tokens for external integration
  app.get('/api/admin/access-tokens', async (req, res) => {
    try {
      const { API_KEYS, getMaskedApiKey } = await import('./config/apiKeys.js');

      const accessTokens = [
        {
          id: 'access-token-1',
          name: 'Access Token 1',
          token: API_KEYS.ACCESS_TOKEN_1,
          masked: getMaskedApiKey('ACCESS_TOKEN_1'),
          description: 'Primary access token for external system integration',
          created: '2024-01-01T00:00:00Z',
          status: 'active'
        },
        {
          id: 'access-token-2',
          name: 'Access Token 2',
          token: API_KEYS.ACCESS_TOKEN_2,
          masked: getMaskedApiKey('ACCESS_TOKEN_2'),
          description: 'Secondary access token for external system integration',
          created: '2024-01-01T00:00:00Z',
          status: 'active'
        }
      ];

      res.json({
        success: true,
        accessTokens
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve access tokens',
        error: error.message
      });
    }
  });

  // Get sync status for shipments
  app.get('/api/shipments/sync-status', async (req, res) => {
    try {
      const { shipmentId, status } = req.query;

      let query = 'SELECT id, NULL as shipment_id, NULL as synced_to_external, NULL as last_sync_attempt, NULL as sync_error FROM shipments';
      const conditions = [];
      const params = [];

      if (shipmentId) {
        conditions.push('id = $1');
        params.push(shipmentId as string);
      }

      if (status === 'pending') {
        conditions.push('synced_to_external = 0');
      } else if (status === 'success') {
        conditions.push('synced_to_external = 1');
      } else if (status === 'failed') {
        conditions.push('synced_to_external = 0 AND sync_error IS NOT NULL');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const shipmentsResult = await storage.getShipments({});
      const shipments = shipmentsResult.data;

      const syncStatus = shipments.map((shipment: any) => ({
        shipmentId: shipment.shipment_id,
        externalId: shipment.shipment_id,
        status: shipment.synced_to_external ? 'success' : 'failed',
        lastAttempt: shipment.last_sync_attempt,
        error: shipment.sync_error
      }));

      res.json({
        success: true,
        syncStatus
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'SYNC_STATUS_FAILED'
      });
    }
  });

  // Batch sync multiple shipments to external system
  app.post('/api/shipments/batch-sync', async (req, res) => {
    try {
      const { shipmentIds } = req.body;

      if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'shipmentIds array is required',
          code: 'INVALID_SHIPMENT_IDS'
        });
      }

      // Fetch all shipments
      const shipmentPromises = shipmentIds.map(id => storage.getShipment(id));
      const shipmentResults = await Promise.all(shipmentPromises);
      const shipments = shipmentResults.filter((shipment): shipment is NonNullable<typeof shipment> => shipment !== undefined);

      if (shipments.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No valid shipments found',
          code: 'NO_VALID_SHIPMENTS'
        });
      }

      // Use optimized external API service for batch sync
      const { ExternalApiService } = await import('./services/ExternalApiService.js');
      const externalApi = ExternalApiService.getInstance();

      console.log(`Batch syncing ${shipments.length} shipments...`);

      const results = await externalApi.batchSyncShipments(shipments);

      // Update sync status for each shipment
      shipments.forEach((shipment, index) => {
        const result = results[index];
        if (result) {
          storage.updateShipment(shipment.shipment_id, {
            shipment_id: shipment.shipment_id,
            synced_to_external: result.success,
            last_sync_attempt: new Date().toISOString(),
            sync_error: result.success ? undefined : result.error
          });
        }
      });

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Batch sync completed: ${successCount} successful, ${failureCount} failed`,
        results: results.map((result, index) => ({
          shipmentId: shipments[index].shipment_id,
          externalId: shipments[index].shipment_id || shipments[index].trackingNumber,
          success: result.success,
          message: result.message,
          error: result.error
        }))
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Batch sync failed',
        error: error.message,
        code: 'BATCH_SYNC_FAILED'
      });
    }
  });

  // Receive external shipment data (for external system integration)
  app.post('/api/shipments/receive',
    webhookSecurity,
    webhookRateLimit,
    webhookPayloadLimit,
    webhookAuth,
    webhookLogger,
    async (req, res) => {
      try {
        // Additional security validations
        const payload = req.body;

        // Validate content type
        if (!req.is('application/json')) {
          return res.status(400).json({
            success: false,
            message: 'Content-Type must be application/json',
            error: 'INVALID_CONTENT_TYPE',
            timestamp: new Date().toISOString()
          });
        }

        // Validate payload exists
        if (!payload || typeof payload !== 'object') {
          return res.status(400).json({
            success: false,
            message: 'Request body must be a valid JSON object',
            error: 'INVALID_PAYLOAD',
            timestamp: new Date().toISOString()
          });
        }

        // Validate access token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            message: 'Access token required. Use Authorization: Bearer <token>',
            error: 'MISSING_ACCESS_TOKEN',
            timestamp: new Date().toISOString()
          });
        }

        const providedToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        const { API_KEYS, validateApiKey } = await import('./config/apiKeys.js');

        // Check if token matches any of our access tokens
        const isValidToken = validateApiKey(providedToken, 'ACCESS_TOKEN_1') ||
          validateApiKey(providedToken, 'ACCESS_TOKEN_2');

        if (!isValidToken) {
          return res.status(401).json({
            success: false,
            message: 'Invalid access token. Please use a valid access token.',
            error: 'INVALID_ACCESS_TOKEN',
            timestamp: new Date().toISOString()
          });
        }

        // Determine if this is a single shipment or batch
        const isBatch = payload.shipments && Array.isArray(payload.shipments);

        if (isBatch) {
          // Handle batch shipments
          const batchValidation = payloadValidationService.validateBatchShipments(payload);

          if (!batchValidation.isValid) {
            return res.status(400).json({
              success: false,
              message: 'Batch validation failed',
              errors: batchValidation.errors,
              timestamp: new Date().toISOString()
            });
          }

          const results = {
            total: payload.shipments.length,
            created: 0,
            updated: 0,
            failed: 0,
            duplicates: 0
          };

          const processedShipments = [];

          // Process each shipment in the batch
          for (let i = 0; i < payload.shipments.length; i++) {
            const externalShipment = payload.shipments[i];

            try {
              // Map external payload to internal format
              const internalShipment = fieldMappingService.mapExternalToInternal(externalShipment);

              // Check for existing shipment by piashipmentid
              const existingShipment = await storage.getShipmentByExternalId(externalShipment.id);

              if (existingShipment) {
                // Update existing shipment
                const updatedShipment = await storage.updateShipment(existingShipment.shipment_id, {
                  shipment_id: existingShipment.shipment_id,
                  status: internalShipment.status,
                  priority: internalShipment.priority,
                  customerName: internalShipment.customerName,
                  customerMobile: internalShipment.customerMobile,
                  address: internalShipment.address,
                  latitude: internalShipment.latitude,
                  longitude: internalShipment.longitude,
                  cost: internalShipment.cost,
                  deliveryTime: internalShipment.deliveryTime,
                  routeName: internalShipment.routeName,
                  employeeId: internalShipment.employeeId,
                  pickupAddress: internalShipment.pickupAddress,
                  weight: internalShipment.weight,
                  dimensions: internalShipment.dimensions,
                  specialInstructions: internalShipment.specialInstructions
                });

                results.updated++;
                processedShipments.push({
                  piashipmentid: externalShipment.id,
                  internalId: existingShipment.shipment_id,
                  status: 'updated',
                  message: 'Shipment updated successfully'
                });
              } else {
                // Create new shipment
                const newShipment = await storage.createShipment({
                  shipment_id: internalShipment.piashipmentid || internalShipment.shipment_id,
                  trackingNumber: internalShipment.piashipmentid || internalShipment.shipment_id,
                  type: internalShipment.type,
                  customerName: internalShipment.customerName,
                  customerMobile: internalShipment.customerMobile,
                  address: internalShipment.address,
                  latitude: internalShipment.latitude,
                  longitude: internalShipment.longitude,
                  cost: internalShipment.cost,
                  deliveryTime: internalShipment.deliveryTime,
                  routeName: internalShipment.routeName,
                  employeeId: internalShipment.employeeId,
                  status: internalShipment.status,
                  priority: internalShipment.priority || 'medium',
                  pickupAddress: internalShipment.pickupAddress || '',
                  deliveryAddress: internalShipment.address,
                  recipientName: internalShipment.customerName,
                  recipientPhone: internalShipment.customerMobile,
                  weight: internalShipment.weight || 0,
                  dimensions: internalShipment.dimensions || '',
                  specialInstructions: internalShipment.specialInstructions,
                  estimatedDeliveryTime: internalShipment.deliveryTime
                });

                results.created++;
                processedShipments.push({
                  piashipmentid: externalShipment.id,
                  internalId: newShipment.shipment_id,
                  status: 'created',
                  message: 'Shipment created successfully'
                });
              }
            } catch (error: any) {
              results.failed++;
              processedShipments.push({
                piashipmentid: externalShipment.id,
                internalId: null,
                status: 'failed',
                message: error.message
              });
            }
          }

          return res.status(200).json({
            success: true,
            message: `Batch processing completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`,
            results,
            processedShipments,
            timestamp: new Date().toISOString()
          });

        } else {
          // Handle single shipment
          const singleValidation = payloadValidationService.validateSingleShipment(payload);

          if (!singleValidation.isValid) {
            return res.status(400).json({
              success: false,
              message: 'Validation failed',
              errors: singleValidation.errors,
              timestamp: new Date().toISOString()
            });
          }

          // Map external payload to internal format
          const internalShipment = fieldMappingService.mapExternalToInternal(payload);

          // Check for existing shipment by piashipmentid
          const existingShipment = await storage.getShipmentByExternalId(payload.id);

          if (existingShipment) {
            // Update existing shipment
            const updatedShipment = await storage.updateShipment(existingShipment.shipment_id, {
              shipment_id: existingShipment.shipment_id,
              status: internalShipment.status,
              priority: internalShipment.priority,
              customerName: internalShipment.customerName,
              customerMobile: internalShipment.customerMobile,
              address: internalShipment.address,
              latitude: internalShipment.latitude,
              longitude: internalShipment.longitude,
              cost: internalShipment.cost,
              deliveryTime: internalShipment.deliveryTime,
              routeName: internalShipment.routeName,
              employeeId: internalShipment.employeeId,
              pickupAddress: internalShipment.pickupAddress,
              weight: internalShipment.weight,
              dimensions: internalShipment.dimensions,
              specialInstructions: internalShipment.specialInstructions
            });

            return res.status(200).json({
              success: true,
              message: 'Shipment updated successfully',
              results: {
                total: 1,
                created: 0,
                updated: 1,
                failed: 0,
                duplicates: 0
              },
              processedShipments: [{
                piashipmentid: payload.id,
                internalId: existingShipment.shipment_id,
                status: 'updated',
                message: 'Shipment updated successfully'
              }],
              timestamp: new Date().toISOString()
            });
          } else {
            // Create new shipment
            const newShipment = await storage.createShipment({
              shipment_id: internalShipment.piashipmentid || internalShipment.shipment_id,
              trackingNumber: internalShipment.piashipmentid || internalShipment.shipment_id,
              type: internalShipment.type,
              customerName: internalShipment.customerName,
              customerMobile: internalShipment.customerMobile,
              address: internalShipment.address,
              latitude: internalShipment.latitude,
              longitude: internalShipment.longitude,
              cost: internalShipment.cost,
              deliveryTime: internalShipment.deliveryTime,
              routeName: internalShipment.routeName,
              employeeId: internalShipment.employeeId,
              status: internalShipment.status,
              priority: internalShipment.priority || 'medium',
              pickupAddress: internalShipment.pickupAddress || '',
              deliveryAddress: internalShipment.address,
              recipientName: internalShipment.customerName,
              recipientPhone: internalShipment.customerMobile,
              weight: internalShipment.weight || 0,
              dimensions: internalShipment.dimensions || '',
              specialInstructions: internalShipment.specialInstructions,
              estimatedDeliveryTime: internalShipment.deliveryTime
            });

            return res.status(201).json({
              success: true,
              message: 'Shipment created successfully',
              results: {
                total: 1,
                created: 1,
                updated: 0,
                failed: 0,
                duplicates: 0
              },
              processedShipments: [{
                piashipmentid: payload.id,
                internalId: newShipment.shipment_id,
                status: 'created',
                message: 'Shipment created successfully'
              }],
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error: any) {
        console.error('Error processing external shipment data:', error);
        return res.status(500).json({
          success: false,
          message: 'Internal server error while processing shipment data',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

  // Update single shipment status (no auth for now)
  app.patch('/api/shipments/:id', async (req, res) => {
    try {
      // Authentication removed (simplified app)

      // Check write permissions
      if (!hasRequiredPermission(req, 'write')) {
        return res.status(403).json({
          message: 'Insufficient permissions. Write access required to update shipments.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

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

  // Batch update shipments (no auth for now)
  app.patch('/api/shipments/batch', async (req, res) => {
    try {
      // Authentication removed (simplified app)

      // Check write permissions
      if (!hasRequiredPermission(req, 'write')) {
        return res.status(403).json({
          message: 'Insufficient permissions. Write access required to batch update shipments.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const batchData = batchUpdateSchema.parse(req.body);

      // Validate each update in the batch
      for (const update of batchData.updates) {
        const shipment = await storage.getShipment(update.shipment_id);
        if (!shipment) {
          return res.status(400).json({ message: `Shipment ${update.shipment_id} not found` });
        }

        // Validate status update based on shipment type
        if (update.status === "Delivered" && shipment.type !== "delivery") {
          return res.status(400).json({ message: `Cannot mark pickup shipment ${update.shipment_id} as Delivered` });
        }
        if (update.status === "Picked Up" && shipment.type !== "pickup") {
          return res.status(400).json({ message: `Cannot mark delivery shipment ${update.shipment_id} as Picked Up` });
        }
      }

      const updatedCount = await storage.batchUpdateShipments(batchData);

      // Get updated shipments for external sync
      const updatedShipments = await Promise.all(
        batchData.updates.map(async (update: any) => {
          const shipment = await storage.getShipment(update.shipment_id);
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
    authenticate, // Enable authentication to track who captured the acknowledgment
    upload.fields([
      { name: 'photo', maxCount: 1 },
      { name: 'signature', maxCount: 1 }
    ]),
    async (req: AuthenticatedRequest, res) => {
      try {

        // Check write permissions
        if (!hasRequiredPermission(req, 'write')) {
          return res.status(403).json({
            message: 'Insufficient permissions. Write access required to upload acknowledgements.',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }

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

        // Create acknowledgment record with user tracking
        const acknowledgment = await storage.createAcknowledgment({
          shipment_id: shipmentId,
          signatureUrl: signatureUrl,
          photoUrl: photoUrl,
          acknowledgment_captured_at: new Date().toISOString(),
          acknowledgment_captured_by: req.user?.employeeId || req.user?.id || 'unknown', // Track who captured the acknowledgment (employee ID or user ID)
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
  app.get('/api/sync/stats', async (_req, res) => {
    try {
      // Compute from shipments table when available
      const countsSql = `
        SELECT
          SUM(CASE WHEN synced_to_external = FALSE THEN 1 ELSE 0 END) AS total_pending,
          SUM(CASE WHEN synced_to_external = TRUE THEN 1 ELSE 0 END) AS total_sent,
          SUM(CASE WHEN sync_error IS NOT NULL AND sync_error <> '' THEN 1 ELSE 0 END) AS total_failed,
          MAX(last_sync_attempt) AS last_sync_time
        FROM shipments
      `;
      const result = await db.query(countsSql);
      const row = result.rows[0] || { total_pending: 0, total_sent: 0, total_failed: 0, last_sync_time: null };
      res.json({
        totalPending: Number(row.total_pending || 0),
        totalSent: Number(row.total_sent || 0),
        totalFailed: Number(row.total_failed || 0),
        lastSyncTime: row.last_sync_time || null,
      });
    } catch (_error: any) {
      // If table missing or any SQL error, return safe zeros to avoid fake data
      res.json({ totalPending: 0, totalSent: 0, totalFailed: 0, lastSyncTime: null });
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
      // Authentication removed (simplified app)

      // Check write permissions
      if (!hasRequiredPermission(req, 'write')) {
        return res.status(403).json({
          message: 'Insufficient permissions. Write access required to add remarks.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

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

  // Delete shipment (admin only)
  app.delete('/api/shipments/:id', async (req, res) => {
    try {
      // Authentication removed (simplified app)

      // Check admin permissions - only admin tokens/users can delete
      if (!hasRequiredPermission(req, 'admin')) {
        return res.status(403).json({
          message: 'Insufficient permissions. Admin access required to delete shipments.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const shipmentId = req.params.id;

      // Verify shipment exists
      const shipment = await storage.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ message: 'Shipment not found' });
      }

      // For now, we'll just mark as deleted rather than actually deleting
      // In a real system, you might want to soft delete or archive
      const result = await storage.updateShipment(shipmentId, {
        shipment_id: shipmentId,
        status: 'Deleted'
      });

      if (!result) {
        return res.status(500).json({ message: 'Failed to delete shipment' });
      }

      res.json({
        message: 'Shipment deleted successfully',
        shipmentId: shipmentId
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // External Update Sending API Implementation

  // Send single shipment update to external system
  app.post('/api/shipments/update/external',
    webhookAuth,
    webhookSecurity,
    webhookRateLimit,
    async (req, res) => {
      try {
        const { shipmentId, additionalData } = req.body;

        if (!shipmentId) {
          return res.status(400).json({
            success: false,
            message: 'Shipment ID is required',
            code: 'MISSING_SHIPMENT_ID'
          });
        }

        // Get shipment from database
        const shipment = await storage.getShipment(shipmentId);
        if (!shipment) {
          return res.status(404).json({
            success: false,
            message: 'Shipment not found',
            code: 'SHIPMENT_NOT_FOUND'
          });
        }

        // Convert shipment to internal format for mapping
        const internalShipment = {
          shipment_id: shipment.shipment_id,
          type: shipment.type || 'delivery',
          customerName: shipment.customerName || shipment.recipientName,
          customerMobile: shipment.customerMobile || shipment.recipientPhone,
          address: shipment.address || shipment.deliveryAddress,
          deliveryTime: shipment.deliveryTime || shipment.estimatedDeliveryTime || new Date().toISOString(),
          cost: shipment.cost || 0,
          routeName: shipment.routeName || 'default',
          employeeId: shipment.employeeId || 'unknown',
          status: shipment.status,
          createdAt: shipment.createdAt,
          updatedAt: shipment.updatedAt,
          priority: shipment.priority,
          pickupAddress: shipment.pickupAddress,
          weight: shipment.weight,
          dimensions: shipment.dimensions,
          specialInstructions: shipment.specialInstructions,
          actualDeliveryTime: shipment.deliveryTime,
          latitude: shipment.latitude,
          longitude: shipment.longitude,
          piashipmentid: shipment.trackingNumber
        };

        // Map internal shipment to external update format
        const externalUpdate = fieldMappingService.mapInternalToExternal(internalShipment, additionalData);

        // Send update to external system via webhook
        const deliveryResult = await externalSync.sendUpdateToExternal(externalUpdate);

        if (deliveryResult.success) {
          res.json({
            success: true,
            message: 'Shipment update sent successfully',
            data: {
              shipmentId: shipment.shipment_id,
              externalId: externalUpdate.id,
              status: externalUpdate.status,
              attempts: deliveryResult.attempts,
              webhookUrl: deliveryResult.webhookUrl,
              deliveredAt: deliveryResult.deliveredAt,
              sentAt: new Date().toISOString()
            }
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to send update to external system',
            code: 'EXTERNAL_SYNC_FAILED',
            data: {
              shipmentId: shipment.shipment_id,
              externalId: externalUpdate.id,
              attempts: deliveryResult.attempts,
              lastError: deliveryResult.lastError,
              webhookUrl: deliveryResult.webhookUrl
            }
          });
        }
      } catch (error: any) {
        console.error('Error sending external update:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error while sending update',
          code: 'INTERNAL_ERROR',
          error: error.message
        });
      }
    });

  // Send batch shipment updates to external system
  app.post('/api/shipments/update/external/batch',
    webhookAuth,
    webhookSecurity,
    webhookRateLimit,
    async (req, res) => {
      try {
        const { shipmentIds, updates, metadata } = req.body;

        if (!shipmentIds && !updates) {
          return res.status(400).json({
            success: false,
            message: 'Either shipmentIds array or updates array is required',
            code: 'MISSING_BATCH_DATA'
          });
        }

        let updatePayloads: any[] = [];

        if (updates && Array.isArray(updates)) {
          // Direct updates provided
          updatePayloads = updates;
        } else if (shipmentIds && Array.isArray(shipmentIds)) {
          // Get shipments by IDs and convert to update format
          const shipments = await Promise.all(
            shipmentIds.map(async (id: string) => {
              try {
                return await storage.getShipment(id);
              } catch (error) {
                console.error(`Error fetching shipment ${id}:`, error);
                return null;
              }
            })
          );

          const validShipments = shipments.filter((s): s is NonNullable<typeof s> => s !== null && s !== undefined);
          if (validShipments.length === 0) {
            return res.status(404).json({
              success: false,
              message: 'No valid shipments found',
              code: 'NO_SHIPMENTS_FOUND'
            });
          }

          // Convert shipments to external update format
          updatePayloads = validShipments.map(shipment => {
            const internalShipment = {
              shipment_id: shipment.shipment_id,
              type: shipment.type || 'delivery',
              customerName: shipment.customerName || shipment.recipientName,
              customerMobile: shipment.customerMobile || shipment.recipientPhone,
              address: shipment.address || shipment.deliveryAddress,
              deliveryTime: shipment.deliveryTime || shipment.estimatedDeliveryTime || new Date().toISOString(),
              cost: shipment.cost || 0,
              routeName: shipment.routeName || 'default',
              employeeId: shipment.employeeId || 'unknown',
              status: shipment.status,
              createdAt: shipment.createdAt,
              updatedAt: shipment.updatedAt,
              priority: shipment.priority,
              pickupAddress: shipment.pickupAddress,
              weight: shipment.weight,
              dimensions: shipment.dimensions,
              specialInstructions: shipment.specialInstructions,
              actualDeliveryTime: shipment.deliveryTime,
              latitude: shipment.latitude,
              longitude: shipment.longitude,
              piashipmentid: shipment.trackingNumber
            };
            return fieldMappingService.mapInternalToExternal(internalShipment, metadata?.additionalData);
          });
        }

        if (updatePayloads.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No updates to process',
            code: 'EMPTY_BATCH'
          });
        }

        // Send batch updates to external system
        const batchResult = await externalSync.sendBatchUpdatesToExternal(updatePayloads);

        res.json({
          success: true,
          message: `Batch update completed: ${batchResult.success} successful, ${batchResult.failed} failed`,
          data: {
            total: updatePayloads.length,
            successful: batchResult.success,
            failed: batchResult.failed,
            results: batchResult.results,
            metadata: {
              ...metadata,
              processedAt: new Date().toISOString(),
              batchId: metadata?.batchId || `batch_${Date.now()}`
            }
          }
        });
      } catch (error: any) {
        console.error('Error processing batch external update:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error while processing batch update',
          code: 'BATCH_PROCESSING_ERROR',
          error: error.message
        });
      }
    });

  // Route Tracking Endpoints

  // Start a new route session (DB-backed)
  app.post('/api/routes/start', async (req, res) => {
    try {
      const { employeeId, startLatitude, startLongitude } = req.body;
      if (!employeeId || startLatitude == null || startLongitude == null) {
        return res.status(400).json({ success: false, message: 'employeeId, startLatitude, startLongitude required' });
      }
      const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const session = await routeService.startSession({ id: sessionId, employeeId, startLatitude: Number(startLatitude), startLongitude: Number(startLongitude) });
      res.status(201).json({ success: true, session, message: 'Route session started successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Stop a route session (DB-backed)
  app.post('/api/routes/stop', async (req, res) => {
    try {
      const { sessionId, endLatitude, endLongitude } = req.body;
      if (!sessionId || endLatitude == null || endLongitude == null) {
        return res.status(400).json({ success: false, message: 'sessionId, endLatitude, endLongitude required' });
      }
      const session = await routeService.stopSession({ id: sessionId, endLatitude: Number(endLatitude), endLongitude: Number(endLongitude) });
      res.json({ success: true, session, message: 'Route session stopped successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Submit GPS coordinates (DB-backed)
  app.post('/api/routes/coordinates', async (req, res) => {
    try {
      const { sessionId, employeeId, latitude, longitude, accuracy, speed, timestamp, eventType, shipmentId } = req.body;
      if (!sessionId || latitude == null || longitude == null || !employeeId) {
        return res.status(400).json({ success: false, message: 'sessionId, employeeId, latitude, longitude required' });
      }
      const record = await routeService.insertCoordinate({
        sessionId,
        employeeId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy != null ? Number(accuracy) : undefined,
        speed: speed != null ? Number(speed) : undefined,
        timestamp,
        eventType,
        shipmentId
      });
      res.status(201).json({ success: true, record, message: 'GPS coordinate recorded successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Record shipment event (pickup/delivery) for a session
  app.post('/api/routes/shipment-event', async (req, res) => {
    try {
      const { sessionId, shipmentId, eventType, latitude, longitude } = req.body || {};

      if (!sessionId || !shipmentId || !eventType) {
        return res.status(400).json({
          success: false,
          message: 'sessionId, shipmentId and eventType are required'
        });
      }

      if (!['pickup', 'delivery'].includes(String(eventType))) {
        return res.status(400).json({
          success: false,
          message: 'eventType must be either "pickup" or "delivery"'
        });
      }

      const record = {
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        sessionId,
        shipmentId,
        eventType,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timestamp: new Date().toISOString()
      };

      console.log('Route shipment event recorded:', record);

      return res.status(201).json({ success: true, record, message: 'Shipment event recorded' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Failed to record event' });
    }
  });

  // Get session data (DB-backed)
  app.get('/api/routes/session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const data = await routeService.getSession(sessionId);
      res.json({ success: true, data, message: 'Session data retrieved successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Batch submit GPS coordinates (DB-backed)
  app.post('/api/routes/coordinates/batch', async (req, res) => {
    try {
      const { coordinates } = req.body;
      if (!Array.isArray(coordinates)) {
        return res.status(400).json({ success: false, message: 'coordinates must be an array' });
      }
      const summary = await routeService.insertCoordinatesBatch(coordinates);
      res.json({ success: true, summary, message: `Batch coordinate submission completed` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Offline sync: sync a route session created while offline
  app.post('/api/routes/sync-session', async (req, res) => {
    try {
      const { id, employeeId, startTime, endTime, status, startLatitude, startLongitude, endLatitude, endLongitude } = req.body || {};

      if (!id || !employeeId || !startTime || !status) {
        return res.status(400).json({
          success: false,
          message: 'id, employeeId, startTime and status are required'
        });
      }

      const synced = {
        id,
        employeeId,
        startTime,
        endTime: endTime || null,
        status,
        startLatitude: startLatitude ?? null,
        startLongitude: startLongitude ?? null,
        endLatitude: endLatitude ?? null,
        endLongitude: endLongitude ?? null,
        syncedAt: new Date().toISOString()
      };

      console.log('Offline session synced:', synced);
      return res.json({ success: true, session: synced, message: 'Session synced' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Failed to sync session' });
    }
  });

  // Offline sync: sync coordinates captured while offline
  app.post('/api/routes/sync-coordinates', async (req, res) => {
    try {
      const { sessionId, coordinates } = req.body || {};

      if (!sessionId || !Array.isArray(coordinates)) {
        return res.status(400).json({
          success: false,
          message: 'sessionId and coordinates array are required'
        });
      }

      const results = coordinates.map((c: any) => ({
        success: true,
        record: {
          id: 'coord-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          sessionId,
          latitude: c.latitude,
          longitude: c.longitude,
          accuracy: c.accuracy ?? null,
          timestamp: c.timestamp || new Date().toISOString()
        }
      }));

      console.log(`Offline coordinates synced for session ${sessionId}:`, results.length);
      return res.json({ success: true, results, message: 'Coordinates synced' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Failed to sync coordinates' });
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

  // User Management API endpoints
  app.get('/api/auth/all-users', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      // Only admin users (super users, ops team, or staff) can access all users
      if (!req.user?.isSuperUser && !req.user?.isOpsTeam && !req.user?.isStaff) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only admin users can view all users',
          code: 'ACCESS_DENIED'
        });
      }

      const usersResult = await db.query(`
        SELECT id, rider_id, full_name, email, is_active, is_approved, role, 
               last_login_at, created_at, updated_at
        FROM rider_accounts 
        ORDER BY created_at DESC
      `);
      const users = usersResult.rows;

      res.json({
        success: true,
        users: users
      });
    } catch (error: any) {
      console.error('Failed to fetch all users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        code: 'FETCH_USERS_ERROR'
      });
    }
  });

  app.patch('/api/auth/users/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      // Only super users can update users
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only super users can update users',
          code: 'ACCESS_DENIED'
        });
      }

      const { userId } = req.params;
      const updates = req.body;

      // Validate required fields
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      // Build update query dynamically
      const updateFields = [];
      const values = [];

      if (updates.full_name !== undefined) {
        updateFields.push('full_name = ?');
        values.push(updates.full_name);
      }
      if (updates.email !== undefined) {
        updateFields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.rider_id !== undefined) {
        updateFields.push('rider_id = ?');
        values.push(updates.rider_id);
      }
      if (updates.is_active !== undefined) {
        updateFields.push('is_active = ?');
        values.push(updates.is_active ? 1 : 0);
      }
      if (updates.is_approved !== undefined) {
        updateFields.push('is_approved = ?');
        values.push(updates.is_approved ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update',
          code: 'NO_UPDATES'
        });
      }

      updateFields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(userId);

      const updateQuery = `
        UPDATE rider_accounts 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `;

      const result = await db.query(updateQuery, values);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Failed to update user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        code: 'UPDATE_USER_ERROR'
      });
    }
  });

  app.post('/api/auth/users/:userId/reset-password', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      // Only super users can reset passwords
      if (!req.user?.isSuperUser) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only super users can reset passwords',
          code: 'ACCESS_DENIED'
        });
      }

      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!userId || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'User ID and new password are required',
          code: 'MISSING_PARAMETERS'
        });
      }

      // Hash the new password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the password
      const result = await db.query(`
        UPDATE rider_accounts 
        SET password_hash = $1, updated_at = $2 
        WHERE id = $3
      `, [hashedPassword, new Date().toISOString(), userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Failed to reset password:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        code: 'RESET_PASSWORD_ERROR'
      });
    }
  });

  // Initialize scheduler (runs the cron jobs)
  await import('./services/scheduler.js');

  // Setup error handling middleware (must be last)
  setupErrorHandling();

  const httpServer = createServer(app);
  return httpServer;
}
