import { Request, Response, NextFunction } from 'express';
import { apiTokenService, ApiToken } from '../services/ApiTokenService.js';

export interface ApiTokenRequest extends Request {
  apiToken?: ApiToken;
  isApiTokenAuth?: boolean;
}

/**
 * Bearer token authentication middleware for API tokens
 * This middleware validates API tokens and sets token information on the request
 */
export const authenticateApiToken = async (req: ApiTokenRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No bearer token provided - continue to next middleware (could be JWT auth)
      return next();
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate the token
    const apiToken = await apiTokenService.validateToken(token);

    if (!apiToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired API token',
        code: 'INVALID_API_TOKEN'
      });
    }

    // Check if token is active
    if (apiToken.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: `API token is ${apiToken.status}`,
        code: 'TOKEN_INACTIVE'
      });
    }

    // Check if token is expired
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'API token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Check permissions based on HTTP method
    const hasPermission = await apiTokenService.checkPermission(apiToken, req.method);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Token has '${apiToken.permissions}' permission but '${req.method}' requires higher privileges`,
        code: 'INSUFFICIENT_PERMISSIONS',
        tokenPermissions: apiToken.permissions,
        requiredMethod: req.method
      });
    }

    // Log token usage
    await apiTokenService.logTokenUsage(apiToken.id, {
      endpoint: req.path,
      method: req.method,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: 200 // Will be updated later if needed
    });

    // Set token information on request
    req.apiToken = apiToken;
    req.isApiTokenAuth = true;

    next();
  } catch (error) {
    console.error('API token authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Middleware to require API token authentication
 * Use this when you want to enforce API token auth only (no JWT fallback)
 */
export const requireApiToken = async (req: ApiTokenRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'API token required. Please provide Authorization: Bearer <token> header',
      code: 'API_TOKEN_REQUIRED'
    });
  }

  // Use the main authentication middleware
  return authenticateApiToken(req, res, next);
};

/**
 * Middleware to check specific API token permissions
 * Use this to enforce specific permission levels beyond HTTP method checking
 */
export const requireApiTokenPermission = (requiredPermission: 'read' | 'write' | 'admin') => {
  return (req: ApiTokenRequest, res: Response, next: NextFunction) => {
    if (!req.apiToken) {
      return res.status(401).json({
        success: false,
        message: 'API token authentication required',
        code: 'API_TOKEN_REQUIRED'
      });
    }

    const tokenPermission = req.apiToken.permissions;

    // Define permission hierarchy
    const permissionLevels = {
      'read': 1,
      'write': 2,
      'admin': 3
    };

    const tokenLevel = permissionLevels[tokenPermission as keyof typeof permissionLevels] || 0;
    const requiredLevel = permissionLevels[requiredPermission];

    if (tokenLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${requiredPermission}, Token has: ${tokenPermission}`,
        code: 'INSUFFICIENT_TOKEN_PERMISSIONS',
        required: requiredPermission,
        current: tokenPermission
      });
    }

    next();
  };
};

/**
 * Combined authentication middleware that supports both JWT and API tokens
 * This allows endpoints to accept either authentication method
 */
export const authenticateEither = async (req: ApiTokenRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide either JWT or API token in Authorization header',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  if (authHeader.startsWith('Bearer ')) {
    // Try API token authentication first
    try {
      const token = authHeader.substring(7);
      const apiToken = await apiTokenService.validateToken(token);

      if (apiToken && apiToken.status === 'active') {
        // Check expiration
        if (!apiToken.expiresAt || new Date(apiToken.expiresAt) >= new Date()) {
          // Valid API token - check permissions
          const hasPermission = await apiTokenService.checkPermission(apiToken, req.method);

          if (hasPermission) {
            // Log usage and set token info
            await apiTokenService.logTokenUsage(apiToken.id, {
              endpoint: req.path,
              method: req.method,
              ipAddress: req.ip || req.connection.remoteAddress,
              userAgent: req.get('User-Agent'),
              statusCode: 200
            });

            req.apiToken = apiToken;
            req.isApiTokenAuth = true;
            return next();
          }
        }
      }
    } catch (error) {
      console.error('API token validation failed, trying JWT:', error);
    }

    // API token failed, try JWT authentication
    // Import the existing JWT auth middleware
    try {
      const { authenticate } = await import('./auth.js');
      return authenticate(req, res, next);
    } catch (error) {
      console.error('JWT authentication also failed:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid authorization header format. Use: Authorization: Bearer <token>',
    code: 'INVALID_AUTH_HEADER'
  });
};

/**
 * Utility function to get user info from either auth method
 * Returns normalized user info regardless of auth method used
 */
export const getAuthenticatedUser = (req: ApiTokenRequest): { id: string; role: string; permissions: string[] } | null => {
  if (req.isApiTokenAuth && req.apiToken) {
    // API token authentication
    return {
      id: `api-token-${req.apiToken.id}`,
      role: req.apiToken.permissions,
      permissions: [req.apiToken.permissions]
    };
  }

  // Check for JWT user (from existing auth middleware)
  const jwtUser = (req as any).user;
  if (jwtUser) {
    return {
      id: jwtUser.id || jwtUser.employeeId,
      role: jwtUser.role || 'user',
      permissions: [jwtUser.role || 'user']
    };
  }

  return null;
};

/**
 * Middleware to log API token usage with response status
 * Use this after your route handler to update the status code in usage logs
 */
export const logApiTokenResponse = (req: ApiTokenRequest, res: Response, next: NextFunction) => {
  if (req.isApiTokenAuth && req.apiToken) {
    // Override res.json to capture status code
    const originalJson = res.json;
    res.json = function (body: any) {
      // Update usage log with actual response status
      apiTokenService.logTokenUsage(req.apiToken!.id, {
        endpoint: req.path,
        method: req.method,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode
      }).catch(error => {
        console.error('Failed to update token usage log:', error);
      });

      return originalJson.call(this, body);
    };
  }
  next();
};