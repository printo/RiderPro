import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

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

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  fullName?: string;
  isActive: boolean;
  accessToken?: string;
  refreshToken?: string;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Initialize users and sessions tables
export const initializeAuth = () => {
  try {
    storage.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        employee_id TEXT,
        full_name TEXT,
        access_token TEXT,
        refresh_token TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    storage.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    console.log('✅ Authentication initialized - using Printo API with Bearer tokens');
  } catch (error) {
    console.error('Failed to initialize authentication:', error);
  }
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
      role: role as any,
      employeeId: userData.employee_id || userData.emp_id || userData.id,
      fullName: userData.full_name || userData.name,
      isOpsTeam: Boolean(userData.is_ops_team),
      isActive: userData.is_active !== false,
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

// Authentication middleware - uses Bearer token directly (no JWT)
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    const accessToken = authHeader.substring(7);

    // Find user by access token
    const userRow = storage
      .prepare(`
        SELECT id, username, email, role, employee_id, full_name, access_token, refresh_token, is_active, last_login, created_at, updated_at
        FROM users
        WHERE access_token = ? AND is_active = 1
      `)
      .get(accessToken) as any;

    if (!userRow) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }

    // Check if session exists and is valid
    const session = storage
      .prepare(`
        SELECT id FROM user_sessions
        WHERE user_id = ? AND access_token = ? AND expires_at > datetime('now')
      `)
      .get(userRow.id, accessToken);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    // Map database columns to interface properties
    const user: User = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      role: userRow.role as UserRole,
      employeeId: userRow.employee_id,
      fullName: userRow.full_name,
      accessToken: userRow.access_token,
      refreshToken: userRow.refresh_token,
      isActive: Boolean(userRow.is_active),
      lastLogin: userRow.last_login,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at
    };

    (req as AuthenticatedRequest).user = user;
    next();
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

  if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.MANAGER) {
    return next();
  }

  if (req.user.role === UserRole.DRIVER) {
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

    // Store/update user in local SQLite for session management
    const existingUser = storage
      .prepare('SELECT id FROM users WHERE id = ?')
      .get(printoUser.id);

    if (existingUser) {
      // Update existing user
      storage.prepare(`
        UPDATE users 
        SET username = ?, email = ?, role = ?, employee_id = ?, full_name = ?, 
            access_token = ?, refresh_token = ?, last_login = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(
        printoUser.username,
        printoUser.email,
        printoUser.role,
        printoUser.employeeId,
        printoUser.fullName,
        printoUser.accessToken,
        printoUser.refreshToken,
        printoUser.id
      );
    } else {
      // Create new user
      storage.prepare(`
        INSERT INTO users (id, username, email, role, employee_id, full_name, access_token, refresh_token, is_active, last_login, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
      `).run(
        printoUser.id,
        printoUser.username,
        printoUser.email,
        printoUser.role,
        printoUser.employeeId,
        printoUser.fullName,
        printoUser.accessToken,
        printoUser.refreshToken
      );
    }

    // Create session with access token (24 hour expiry)
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    storage.prepare(`
      INSERT OR REPLACE INTO user_sessions (id, user_id, access_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, printoUser.id, printoUser.accessToken, expiresAt);

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
    storage.prepare(`
      UPDATE users SET access_token = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newAccess, userId);

    // Update session to extend 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    storage.prepare(`
      INSERT OR REPLACE INTO user_sessions (id, user_id, access_token, expires_at)
      VALUES ((SELECT id FROM user_sessions WHERE user_id = ? LIMIT 1), ?, ?, ?)
    `).run(userId, userId, newAccess, expiresAt);

    return newAccess;
  } catch (e) {
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
export const cleanupExpiredSessions = () => {
  try {
    const result = storage.prepare(`
      DELETE FROM user_sessions
      WHERE expires_at < datetime('now')
    `).run();

    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired sessions`);
    }
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
};