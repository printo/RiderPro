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
import { apiTokenService } from "./services/ApiTokenService.js";
import { authenticateEither, getAuthenticatedUser, ApiTokenRequest, requireApiTokenPermission } from "./middleware/apiTokenAuth.js";
import { apiTokenDbInitializer } from "./db/apiTokenInit.js";
import { apiTokenErrorHandler, ApiTokenErrorHandler, ApiTokenErrorCode } from "./utils/apiTokenErrorHandler.js";
import { validateTokenCreationData, checkRateLimit } from "./utils/tokenValidation.js";
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
function hasRequiredPermission(req: ApiTokenRequest, requiredLevel: 'read' | 'write' | 'admin'): boolean {
  if (req.isApiTokenAuth && req.apiToken) {
    // For API tokens, check permission hierarchy
    const tokenPermission = req.apiToken.permissions;
    const permissionLevels = { 'read': 1, 'write': 2, 'admin': 3 };
    const tokenLevel = permissionLevels[tokenPermission as keyof typeof permissionLevels] || 0;
    const requiredLevelNum = permissionLevels[requiredLevel];
    return tokenLevel >= requiredLevelNum;
  } else {
    // For JWT tokens, check role
    const authUser = getAuthenticatedUser(req);
    if (!authUser) return false;

    // Map JWT roles to permission levels
    const role = authUser.role;
    if (requiredLevel === 'admin') {
      return role === 'admin' || role === 'super_admin';
    } else if (requiredLevel === 'write') {
      return role === 'admin' || role === 'super_admin' || role === 'user';
    } else { // read
      return true; // All authenticated users can read
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add request ID middleware for better error tracking
  app.use(ApiTokenErrorHandler.requestIdMiddleware());

  // Add error handling middleware at the end
  const setupErrorHandling = () => {
    app.use(ApiTokenErrorHandler.errorMiddleware());
  };
  // Auth endpoints
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Call external auth API
      const response = await fetch('https://pia.printo.in/api/v1/auth/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const data = await response.json();

      // Handle the actual response format from Printo API
      const accessToken = data.data?.accessToken || data.access;
      const refreshToken = data.data?.refreshToken || data.refresh;
      const userData = data.data?.user || data.user || {};

      if (!accessToken) {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed'
        });
      }

      // Map the role from the actual response to match frontend UserRole enum
      let role = 'driver'; // default to driver instead of user
      if (userData.role === 'admin' || userData.is_admin) {
        role = 'admin';
      } else if (userData.role === 'super_admin' || userData.is_super_admin) {
        role = 'super_admin';
      } else if (userData.role === 'ops_team' || userData.is_ops_team) {
        role = 'ops_team'; // Match the frontend enum
      } else if (userData.role === 'delivery' || userData.is_delivery) {
        role = 'driver'; // Map delivery to driver role
      }

      const user = {
        id: userData.id || userData.user_id?.toString() || email,
        email: userData.email || email,
        name: userData.name || userData.full_name || `Employee ${email}`,
        role,
        employeeId: userData.employeeId || userData.employee_id || userData.id || email,
      };

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken: refreshToken || null,
          user
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { userId, refresh } = req.body;

      if (!refresh) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Call external refresh API
      const response = await fetch('https://pia.printo.in/api/v1/auth/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refresh }),
      });

      if (!response.ok) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      const data = await response.json();

      const accessToken = data.access || data.accessToken;
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          message: 'Failed to refresh token'
        });
      }

      res.json({
        success: true,
        data: {
          accessToken: accessToken
        }
      });
    } catch (error: any) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  // API Token Database Health Check
  app.get('/api/admin/tokens/health', async (req, res) => {
    try {
      // Check admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);

      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Get health status
      const healthStatus = await apiTokenDbInitializer.getHealthStatus();

      // If not initialized, trigger initialization
      if (!healthStatus.tablesExist) {
        console.log('🔧 Tables not found, triggering database initialization...');
        const initResult = await apiTokenDbInitializer.initializeDatabase();

        return res.json({
          success: initResult.success,
          message: initResult.success ? 'Database initialized successfully' : 'Database initialization failed',
          health: healthStatus,
          initialization: {
            tablesCreated: initResult.tablesCreated,
            indexesCreated: initResult.indexesCreated,
            errors: initResult.errors,
            initializationTime: initResult.initializationTime
          }
        });
      }

      res.json({
        success: true,
        message: 'API token database is healthy',
        health: healthStatus,
        initialized: apiTokenDbInitializer.isInitialized()
      });
    } catch (error: any) {
      console.error('Error checking API token database health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check database health',
        error: error.message || 'Unknown error'
      });
    }
  });

  // API Token Error Statistics
  app.get('/api/admin/tokens/errors', async (req, res) => {
    try {
      // Check admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);

      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Get error statistics
      const errorStats = apiTokenErrorHandler.getErrorStats();
      const recentErrors = apiTokenErrorHandler.getRecentErrors(20);

      res.json({
        success: true,
        message: 'Error statistics retrieved successfully',
        data: {
          statistics: errorStats,
          recentErrors: recentErrors.map(error => ({
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            timestamp: error.timestamp,
            requestId: error.requestId
          }))
        }
      });
    } catch (error: any) {
      console.error('Error fetching error statistics:', error);
      const apiError = apiTokenErrorHandler.handleSystemError('get_error_stats', error, req.requestId);
      apiTokenErrorHandler.sendErrorResponse(res, apiError);
    }
  });

  // API Token Database Maintenance
  app.post('/api/admin/tokens/maintenance', async (req, res) => {
    try {
      // Check admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);

      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Perform maintenance
      const maintenanceResult = await apiTokenDbInitializer.performMaintenance();

      res.json({
        success: maintenanceResult.errors.length === 0,
        message: maintenanceResult.errors.length === 0 ? 'Maintenance completed successfully' : 'Maintenance completed with errors',
        maintenance: maintenanceResult
      });
    } catch (error: any) {
      console.error('Error performing API token database maintenance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform database maintenance',
        error: error.message || 'Unknown error'
      });
    }
  });

  // API Token Management endpoints
  // POST /api/admin/tokens - Create new token
  app.post('/api/admin/tokens', async (req, res) => {
    try {
      // Check rate limiting first
      const rateLimitResult = checkRateLimit(req);
      if (!rateLimitResult.allowed) {
        const resetTime = rateLimitResult.resetTime ? new Date(rateLimitResult.resetTime).toISOString() : 'unknown';
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded. Too many token creation attempts.',
          resetTime
        });
      }

      // Check admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);

      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Validate and sanitize input data
      const validationResult = validateTokenCreationData(req.body);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors
        });
      }

      const { name, description, permissions, expirationOption, customExpiration } = validationResult.sanitizedData!;

      // Calculate expiration date
      let expiresAt: Date | undefined;
      if (expirationOption && expirationOption !== 'never') {
        const now = new Date();
        switch (expirationOption) {
          case '30days':
            expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
            break;
          case '1year':
            expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            break;
          case 'custom':
            if (customExpiration) {
              expiresAt = new Date(customExpiration);
            }
            break;
        }
      }

      const result = await apiTokenService.createToken({
        name,
        description,
        permissions,
        expiresAt,
        createdBy: user.employeeId
      }, req.requestId);

      res.status(201).json({
        success: true,
        data: {
          token: result.token,
          tokenData: result.tokenData
        },
        message: 'API token created successfully'
      });
    } catch (error: any) {
      console.error('Error creating API token:', error);

      // Use centralized error handling
      let apiError;
      if (error.message.includes('UNIQUE constraint failed') || error.message.includes('already exists')) {
        apiError = apiTokenErrorHandler.createError(
          ApiTokenErrorCode.TOKEN_NAME_EXISTS,
          'A token with this name already exists',
          409,
          undefined,
          req.requestId
        );
      } else {
        apiError = apiTokenErrorHandler.handleSystemError('create_token', error, req.requestId);
      }

      apiTokenErrorHandler.sendErrorResponse(res, apiError);
    }
  });

  // GET /api/admin/tokens - List all tokens
  app.get('/api/admin/tokens', async (req, res) => {
    try {
      // Check admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);

      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const tokens = await apiTokenService.getTokens(req.requestId);

      res.json({
        success: true,
        data: tokens,
        message: 'API tokens retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching API tokens:', error);
      const apiError = apiTokenErrorHandler.handleSystemError('get_tokens', error, req.requestId);
      apiTokenErrorHandler.sendErrorResponse(res, apiError);
    }
  });

  // PATCH /api/admin/tokens/:id/status - Enable/disable/revoke token
  app.patch('/api/admin/tokens/:id/status', async (req, res) => {
    try {
      // Check admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);

      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const tokenId = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(tokenId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token ID'
        });
      }

      if (!status || !['active', 'disabled', 'revoked'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active, disabled, or revoked'
        });
      }

      let success = false;
      let message = '';

      if (status === 'revoked') {
        success = await apiTokenService.revokeToken(tokenId);
        message = success ? 'Token revoked successfully' : 'Token not found or already revoked';
      } else {
        success = await apiTokenService.toggleTokenStatus(tokenId, status);
        message = success ? `Token ${status} successfully` : 'Token not found or cannot be modified';
      }

      if (!success) {
        return res.status(404).json({
          success: false,
          message
        });
      }

      res.json({
        success: true,
        message
      });
    } catch (error: any) {
      console.error('Error updating token status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update token status'
      });
    }
  });

  // GET /api/admin/tokens/:id/usage - Get token usage statistics
  app.get('/api/admin/tokens/:id/usage', async (req, res) => {
    try {
      // Check admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);

      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const tokenId = parseInt(req.params.id);

      if (isNaN(tokenId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token ID'
        });
      }

      // Verify token exists
      const tokenData = await apiTokenService.getTokenById(tokenId);
      if (!tokenData) {
        return res.status(404).json({
          success: false,
          message: 'Token not found'
        });
      }

      const usage = await apiTokenService.getTokenUsage(tokenId);

      res.json({
        success: true,
        data: {
          token: tokenData,
          usage
        },
        message: 'Token usage statistics retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching token usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch token usage statistics'
      });
    }
  });

  // GET /api/admin/tokens/analytics - Get comprehensive usage analytics
  app.get('/api/admin/tokens/analytics', async (req, res) => {
    try {
      // Check admin authentication
      if (!hasRequiredPermission(req as ApiTokenRequest, 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const analytics = await apiTokenService.getUsageAnalytics();

      res.json({
        success: true,
        data: analytics,
        message: 'Usage analytics retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching usage analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch usage analytics'
      });
    }
  });

  // GET /api/admin/tokens/patterns - Get usage patterns
  app.get('/api/admin/tokens/patterns', async (req, res) => {
    try {
      // Check admin authentication
      if (!hasRequiredPermission(req as ApiTokenRequest, 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const days = parseInt(req.query.days as string) || 30;
      if (days < 1 || days > 365) {
        return res.status(400).json({
          success: false,
          message: 'Days parameter must be between 1 and 365'
        });
      }

      const patterns = await apiTokenService.getUsagePatterns(days);

      res.json({
        success: true,
        data: patterns,
        message: 'Usage patterns retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching usage patterns:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch usage patterns'
      });
    }
  });

  // GET /api/admin/tokens/export - Export usage data
  app.get('/api/admin/tokens/export', async (req, res) => {
    try {
      // Check admin authentication
      if (!hasRequiredPermission(req as ApiTokenRequest, 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const includeUsageLogs = req.query.includeLogs === 'true';
      const format = req.query.format as string || 'json';

      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Format must be either "json" or "csv"'
        });
      }

      const exportData = await apiTokenService.exportUsageData(includeUsageLogs);

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = convertToCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="token-usage-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvData);
      } else {
        // Return JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="token-usage-${new Date().toISOString().split('T')[0]}.json"`);
        res.json({
          success: true,
          data: exportData,
          message: 'Usage data exported successfully'
        });
      }
    } catch (error: any) {
      console.error('Error exporting usage data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export usage data'
      });
    }
  });

  // GET /api/admin/tokens/expiring - Get tokens that are expiring soon
  app.get('/api/admin/tokens/expiring', async (req, res) => {
    try {
      // Check admin authentication
      if (!hasRequiredPermission(req as ApiTokenRequest, 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const warningDays = parseInt(req.query.warningDays as string) || 7;
      if (warningDays < 1 || warningDays > 365) {
        return res.status(400).json({
          success: false,
          message: 'Warning days must be between 1 and 365'
        });
      }

      const expiringTokens = await apiTokenService.getExpiringTokens(warningDays);

      res.json({
        success: true,
        data: expiringTokens,
        message: 'Expiring tokens retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching expiring tokens:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expiring tokens'
      });
    }
  });

  // POST /api/admin/tokens/cleanup - Process expired tokens and cleanup old data
  app.post('/api/admin/tokens/cleanup', async (req, res) => {
    try {
      // Check admin authentication
      if (!hasRequiredPermission(req as ApiTokenRequest, 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const cleanupResult = await apiTokenService.cleanupExpiredData();

      res.json({
        success: true,
        data: cleanupResult,
        message: `Cleanup completed: ${cleanupResult.expiredTokens} tokens expired, ${cleanupResult.oldLogs} old logs removed`
      });
    } catch (error: any) {
      console.error('Error during cleanup:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform cleanup'
      });
    }
  });

  // GET /api/admin/tokens/expiration-status - Get expiration monitoring status
  app.get('/api/admin/tokens/expiration-status', async (req, res) => {
    try {
      // Check admin authentication
      if (!hasRequiredPermission(req as ApiTokenRequest, 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { tokenExpirationService } = await import('./services/TokenExpirationService.js');
      const status = tokenExpirationService.getStatus();
      const expiringTokens = await apiTokenService.getExpiringTokens(7);

      res.json({
        success: true,
        data: {
          service: status,
          tokens: {
            expiringSoon: expiringTokens.expiringSoon.length,
            expired: expiringTokens.expired.length,
            neverExpire: expiringTokens.neverExpire.length
          }
        },
        message: 'Expiration status retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error fetching expiration status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expiration status'
      });
    }
  });

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
      } else if (userData.is_admin || userData.role === 'admin') {
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

  // Get single shipment
  app.get('/api/shipments/:id', authenticateEither, async (req: ApiTokenRequest, res) => {
    try {
      // Verify authentication
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ message: 'Authentication required' });
      }

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
  app.post('/api/shipments', authenticateEither, async (req: ApiTokenRequest, res) => {
    try {
      // Verify authentication
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ message: 'Authentication required' });
      }

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

  // Update single shipment status
  app.patch('/api/shipments/:id', authenticateEither, async (req: ApiTokenRequest, res) => {
    try {
      // Verify authentication
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ message: 'Authentication required' });
      }

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

  // Batch update shipments
  app.patch('/api/shipments/batch', authenticateEither, async (req: ApiTokenRequest, res) => {
    try {
      // Verify authentication
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ message: 'Authentication required' });
      }

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
    authenticateEither,
    upload.fields([
      { name: 'photo', maxCount: 1 },
      { name: 'signature', maxCount: 1 }
    ]),
    async (req: ApiTokenRequest, res) => {
      try {
        // Verify authentication
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
          return res.status(401).json({ message: 'Authentication required' });
        }

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
  app.post('/api/shipments/:id/remarks', authenticateEither, async (req: ApiTokenRequest, res) => {
    try {
      // Verify authentication
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ message: 'Authentication required' });
      }

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
  app.delete('/api/shipments/:id', authenticateEither, async (req: ApiTokenRequest, res) => {
    try {
      // Verify authentication
      const authUser = getAuthenticatedUser(req);
      if (!authUser) {
        return res.status(401).json({ message: 'Authentication required' });
      }

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

  // Setup error handling middleware (must be last)
  setupErrorHandling();

  const httpServer = createServer(app);
  return httpServer;
}
