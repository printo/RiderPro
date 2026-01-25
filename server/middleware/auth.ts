import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { log } from "../../shared/utils/logger.js";
import { User } from '@shared/types';

// User roles for role-based access control
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  VIEWER = 'viewer'
}

// Permissions for different actions
export enum Permission {
  VIEW_ALL_ROUTES = 'view_all_routes',
  VIEW_OWN_ROUTES = 'view_own_routes',
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
  MANAGE_USERS = 'manage_users',
  VIEW_LIVE_TRACKING = 'view_live_tracking',
  ACCESS_AUDIT_LOGS = 'access_audit_logs',
  CONFIGURE_SYSTEM = 'configure_system'
}

// Role-permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.VIEW_ALL_ROUTES,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_USERS,
    Permission.VIEW_LIVE_TRACKING,
    Permission.ACCESS_AUDIT_LOGS,
    Permission.CONFIGURE_SYSTEM
  ],
  [UserRole.MANAGER]: [
    Permission.VIEW_ALL_ROUTES,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.VIEW_LIVE_TRACKING
  ],
  [UserRole.DRIVER]: [Permission.VIEW_OWN_ROUTES],
  [UserRole.VIEWER]: [Permission.VIEW_ANALYTICS]
};

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Initialize users and sessions tables
export const initializeAuth = () => {
  // Authentication tables are now initialized in db/connection.ts
  log.dev('✅ Authentication initialized - using Printo API with Bearer tokens');
};

// Printo API authentication configuration
const PRINTO_API_BASE_URL = process.env.PRINTO_API_BASE_URL || 'https://pia.printo.in/api/v1';
const PRINTO_LOGIN_URL = `${PRINTO_API_BASE_URL}/auth/`;
const PRINTO_REFRESH_URL = `${PRINTO_API_BASE_URL}/auth/refresh/`;

// Call Printo authentication API
const authenticateWithPrintoAPI = async (email: string, password: string) => {
  try {
    // Login to Printo API
    const loginResponse = await fetch(PRINTO_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!loginResponse.ok) {
      return null;
    }

    const loginData = await loginResponse.json();

    // Extract tokens from response
    const accessToken = loginData.access || loginData.access_token;
    const refreshToken = loginData.refresh || loginData.refresh_token;

    if (!accessToken) {
      return null;
    }

    // Get user info from login response or make additional call if needed
    const userData = loginData.user || loginData;

    // Map Printo/Django user data to literal role names when available
    const role = (
      userData.role ||
      (userData.is_super_user ? 'admin' :
        userData.is_ops_team ? 'isops' :
          userData.is_delivery ? 'isdelivery' :
            'user')
    );

    return {
      id: userData.id || userData.user_id || email,
      username: userData.username || email,
      email: userData.email || email,
      role: role as UserRole,
      employeeId: userData.employee_id || userData.emp_id || userData.id,
      fullName: userData.full_name || userData.name,
      isOpsTeam: Boolean(userData.is_ops_team),
      isActive: userData.is_active !== false,
      isStaff: Boolean(userData.is_staff),
      isSuperUser: Boolean(userData.is_super_user),
      accessToken,
      refreshToken,
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Printo API authentication failed:', error);
    return null;
  }
};

// Authentication middleware - hybrid approach supporting both Printo and Legacy tokens
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    const accessToken = authHeader.substring(7);

    // 1. Try New System: Check 'users' table in main storage (Postgres)
    // This handles users logged in via Printo Proxy
    try {
      let user = await storage.getUserByToken(accessToken);

      // If not found by direct token match, check active session
      if (!user) {
        const session = await storage.getSessionByToken(accessToken);

        if (session) {
          user = await storage.getUserById(session.user_id);
        }
      }

      if (user) {
        // Ensure boolean flags are set (though storage should handle this)
        // Storage returns User interface which has these fields
        (req as AuthenticatedRequest).user = user;
        return next();
      }
    } catch (_e) {
      // Continue to legacy check if new DB check fails/errors
    }

    // 2. Legacy System Check (Disabled for Docker migration)
    if (accessToken.startsWith('local_')) {
      // Legacy SQLite logic removed. If needed, migrate data to Postgres 'rider_accounts'
      log.warn('Legacy token format detected but legacy DB support is disabled in Docker environment.');
    }

    // 3. Fallback: Token is invalid or expired
    return res.status(401).json({ success: false, message: 'Invalid or expired token', code: 'INVALID_TOKEN' });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Authorization middleware
export const authorize = (requiredPermission: Permission) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role as UserRole] || [];

    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: requiredPermission,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Employee data access control
export const authorizeEmployeeAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  const requestedEmployeeId = req.params.employeeId || req.query.employeeId || req.body.employeeId;

  if (req.user.isSuperUser || req.user.isOpsTeam || req.user.isStaff) {
    return next();
  }

  if (!req.user.isSuperUser && !req.user.isOpsTeam && !req.user.isStaff) {
    if (requestedEmployeeId && requestedEmployeeId !== req.user.employeeId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Can only access own data',
        code: 'EMPLOYEE_ACCESS_DENIED'
      });
    }
  }

  next();
};

// Main authentication function
export const authenticateUser = async (email: string, password: string) => {
  try {
    // Authenticate with Printo API
    const printoUser = await authenticateWithPrintoAPI(email, password);

    if (!printoUser) {
      throw new Error('Authentication failed with Printo API');
    }

    // Store/update user in local DB for session management
    const existingUser = await storage.getUserById(printoUser.id);

    if (existingUser) {
      // Update existing user
      await storage.updateUser(printoUser.id, {
        username: printoUser.username,
        email: printoUser.email,
        role: printoUser.role,
        employeeId: printoUser.employeeId,
        fullName: printoUser.fullName,
        accessToken: printoUser.accessToken,
        refreshToken: printoUser.refreshToken,
        isSuperUser: printoUser.isSuperUser,
        isOpsTeam: printoUser.isOpsTeam,
        isStaff: printoUser.isStaff,
        lastLogin: new Date().toISOString()
      });
    } else {
      // Create new user
      await storage.createUser({
        id: printoUser.id,
        username: printoUser.username,
        email: printoUser.email,
        role: printoUser.role,
        employeeId: printoUser.employeeId,
        fullName: printoUser.fullName,
        accessToken: printoUser.accessToken,
        refreshToken: printoUser.refreshToken,
        isActive: true,
        isApproved: true,
        isRider: printoUser.role === UserRole.DRIVER,
        isSuperUser: printoUser.isSuperUser,
        isOpsTeam: printoUser.isOpsTeam,
        isStaff: printoUser.isStaff,
        lastLogin: new Date().toISOString()
      });
    }

    // Create session with access token (24 hour expiry)
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await storage.createSession({
      id: sessionId,
      user_id: printoUser.id,
      access_token: printoUser.accessToken,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    });

    return printoUser;
  } catch (error) {
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Refresh access token using Django refresh token
export const refreshAccessTokenForUser = async (userId: string, refreshToken: string) => {
  try {
    const res = await fetch(PRINTO_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newAccess = data.access || data.access_token;
    if (!newAccess) return null;

    // Update stored access token
    await storage.updateUser(userId, { accessToken: newAccess });

    // const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // So updating user table is enough for the first check.
    // But for session check, we need to update session.
    // Let's leave session update for now as we don't have session ID.
    // Ideally we should pass session ID to this function or fetch it.
    
    return newAccess;
  } catch (_e) {
    return null;
  }
};

// Helper function to make authenticated requests to Printo API
export const makePrintoAPIRequest = async (endpoint: string, accessToken: string, options: RequestInit = {}) => {
  const url = `${PRINTO_API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Printo API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const getUserPermissions = (role: UserRole): Permission[] => ROLE_PERMISSIONS[role] || [];

export const hasPermission = (userRole: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};

// Session cleanup
export const cleanupExpiredSessions = async () => {
  try {
    const count = await storage.deleteExpiredSessions();

    if (count > 0) {
      log.dev(`Cleaned up ${count} expired sessions`);
    }
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
};
