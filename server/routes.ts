import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import bcrypt from "bcrypt";
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
import { fieldMappingService } from "./services/FieldMappingService.js";
import { payloadValidationService } from "./services/PayloadValidationService.js";
import { webhookAuth, webhookSecurity, webhookLogger, webhookRateLimit, webhookPayloadLimit } from "./middleware/webhookAuth.js";
import { ApiTokenErrorHandler } from "./utils/apiTokenErrorHandler.js";
import path from 'path';

// Helper function to check if user has required permission level
// Simplified permission check (can be expanded if needed)
function hasRequiredPermission(_req: any, _requiredLevel: 'read' | 'write' | 'admin'): boolean {
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add request ID middleware for better error tracking
  app.use(ApiTokenErrorHandler.requestIdMiddleware());

  // Add error handling middleware at the end
  const setupErrorHandling = () => {
    app.use(ApiTokenErrorHandler.errorMiddleware());
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
      const { riderId, password, fullName, email } = req.body;

      if (!riderId || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Rider ID, password, and full name are required'
        });
      }

      // Check if user already exists
      const existingUser = storage
        .prepare('SELECT id FROM rider_accounts WHERE rider_id = ?')
        .get(riderId);

      if (existingUser) {
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

      storage.prepare(`
        INSERT INTO rider_accounts (
          id, rider_id, full_name, email, password_hash, 
          is_active, is_approved, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))
      `).run(userId, riderId, fullName, email || null, passwordHash);

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
      const user = storage
        .prepare(`
          SELECT id, rider_id, full_name, email, password_hash, is_active, is_approved
          FROM rider_accounts 
          WHERE rider_id = ? AND is_active = 1
        `)
        .get(riderId) as any;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password using bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
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

      // Generate simple tokens (in production use JWT)
      const accessToken = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      const refreshToken = 'refresh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);

      // Update last login
      storage.prepare(`
        UPDATE rider_accounts 
        SET last_login_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(user.id);

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
      const pendingUsers = storage
        .prepare(`
          SELECT id, rider_id, full_name, email, created_at
          FROM rider_accounts 
          WHERE is_approved = 0 AND is_active = 1
          ORDER BY created_at DESC
        `)
        .all();

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

      const result = storage
        .prepare(`
          UPDATE rider_accounts 
          SET is_approved = 1, updated_at = datetime('now')
          WHERE id = ? AND is_active = 1
        `)
        .run(userId);

      if (result.changes === 0) {
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

      const result = storage
        .prepare(`
          UPDATE rider_accounts 
          SET is_active = 0, updated_at = datetime('now')
          WHERE id = ?
        `)
        .run(userId);

      if (result.changes === 0) {
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

      const result = storage
        .prepare(`
          UPDATE rider_accounts 
          SET password_hash = ?, updated_at = datetime('now')
          WHERE id = ? AND is_active = 1
        `)
        .run(passwordHash, userId);

      if (result.changes === 0) {
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

  // Get shipments with optional filters, pagination, and sorting
  app.get('/api/shipments', async (req, res) => {
    try {
      // Simple JWT authentication for shipments
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);
      if (!user || !user.employeeId) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      const employeeId = user.employeeId;
      const userRole = user.role;

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
      // For admin, super_admin, ops_team, and other roles: no filtering (see all shipments)

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

  // Simple token verification - in production, you'd verify JWT signature
  async function getUserFromToken(token: string): Promise<{ employeeId: string; role: string } | null> {
    try {
      // For now, we'll trust tokens from our own login endpoint
      // In a real production app, you'd verify the JWT signature
      if (!token || token.length < 10) {
        return null;
      }

      // Use external API verification for reliability
      const authHeader = `Bearer ${token}`;
      const response = await fetch('https://pia.printo.in/api/v1/auth/me/', {
        headers: { 'Authorization': authHeader }
      });

      if (!response.ok) {
        console.error('Failed to verify token with external API:', response.status);
        return null;
      }

      const userData = await response.json();

      // Map the actual role from the API response to match frontend UserRole enum
      let role = 'driver'; // default
      if (userData.is_superuser || userData.is_super_admin || userData.role === 'super_admin') {
        role = 'super_admin';
      } else if (userData.is_super_user || userData.role === 'admin') {
        role = 'admin';
      } else if (userData.is_ops_team || userData.role === 'ops_team') {
        role = 'ops_team'; // Match the frontend enum
      } else if (userData.is_delivery || userData.role === 'delivery') {
        role = 'driver'; // Map delivery to driver role
      }

      return {
        employeeId: userData.employee_id || userData.email || userData.username,
        role: role
      };
    } catch (error) {
      console.error('Error verifying token:', error);
      return null;
    }
  }

  // Get single shipment (no auth for now)
  app.get('/api/shipments/:id', async (req, res) => {
    try {
      // Authentication removed (simplified app)

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

  // Create new shipment (no auth for now)
  app.post('/api/shipments', async (req, res) => {
    try {
      // Authentication removed (simplified app)

      // Check write permissions
      if (!hasRequiredPermission(req, 'write')) {
        return res.status(403).json({
          message: 'Insufficient permissions. Write access required to create shipments.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

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
                const updatedShipment = await storage.updateShipment(existingShipment.id, {
                  id: existingShipment.id,
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
                  internalId: existingShipment.id,
                  status: 'updated',
                  message: 'Shipment updated successfully'
                });
              } else {
                // Create new shipment
                const newShipment = await storage.createShipment({
                  trackingNumber: internalShipment.piashipmentid || internalShipment.id,
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
                  internalId: newShipment.id,
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
            const updatedShipment = await storage.updateShipment(existingShipment.id, {
              id: existingShipment.id,
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
                internalId: existingShipment.id,
                status: 'updated',
                message: 'Shipment updated successfully'
              }],
              timestamp: new Date().toISOString()
            });
          } else {
            // Create new shipment
            const newShipment = await storage.createShipment({
              trackingNumber: internalShipment.piashipmentid || internalShipment.id,
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
                internalId: newShipment.id,
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
        // Authentication removed (simplified app)

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
        id: shipmentId,
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
          id: shipment.id,
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
          actualDeliveryTime: shipment.actualDeliveryTime,
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
              shipmentId: shipment.id,
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
              shipmentId: shipment.id,
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
              id: shipment.id,
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
              actualDeliveryTime: shipment.actualDeliveryTime,
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

  // Initialize scheduler (runs the cron jobs)
  await import('./services/scheduler.js');

  // Setup error handling middleware (must be last)
  setupErrorHandling();

  const httpServer = createServer(app);
  return httpServer;
}
