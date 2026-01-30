import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { log } from "../../shared/utils/logger.js";
import { User } from '@shared/types';
import { existsSync } from 'fs';

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

// POPS API authentication configuration - using PIA's token system
// POPS_API_BASE_URL must be set in environment variables
// From Docker, use host.docker.internal or host IP instead of localhost
let API_BASE_URL = process.env.POPS_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('POPS_API_BASE_URL environment variable is required');
}

// Replace localhost or host.docker.internal with gateway IP when running in Docker
// WSL2 doesn't support host.docker.internal, so we need the gateway IP (172.21.0.1)
// This allows the container to reach services on the host machine (port 8002)
log.dev(`[AUTH INIT] Checking API_BASE_URL replacement: ${API_BASE_URL}`);
if (API_BASE_URL && (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('host.docker.internal'))) {
  const gatewayIp = '172.21.0.1';
  const originalUrl = API_BASE_URL;
  // Replace both localhost and host.docker.internal with gateway IP
  API_BASE_URL = API_BASE_URL.replace('localhost', gatewayIp).replace('host.docker.internal', gatewayIp);
  log.dev(`[AUTH] ✅ Replaced with gateway IP: ${originalUrl} -> ${API_BASE_URL}`);
} else {
  log.dev(`[AUTH INIT] No replacement needed: ${API_BASE_URL}`);
}

// POPS token endpoints (using PIA's token system format)
// These are created AFTER the localhost replacement above
const LOGIN_URL = `${API_BASE_URL}/auth/`;
const REFRESH_URL = `${API_BASE_URL}/auth/refresh/`;  // Uses /refresh/ endpoint
const VERIFY_URL = `${API_BASE_URL}/auth/token-verify/`;

// Initialize users and sessions tables
export const initializeAuth = () => {
  // Authentication tables are now initialized in db/connection.ts
  console.log(`[AUTH INIT] Final API_BASE_URL: ${API_BASE_URL}`);
  console.log(`[AUTH INIT] LOGIN_URL: ${LOGIN_URL}`);
  log.dev(`✅ Authentication initialized - using POPS API at ${API_BASE_URL}`);
};

// Call POPS authentication API (using PIA's token system)
const authenticateWithPrintoAPI = async (email: string, password: string) => {
  let loginResponse: globalThis.Response | null = null;
  let lastError: Error | null = null;

  // Login using POPS API
  try {
    // Ensure we use gateway IP if running in Docker (WSL2 doesn't support host.docker.internal)
    // From pops-prod-ui/server.js: proxies /api to http://0.0.0.0:8002
    // So we need to connect directly to port 8002 from Docker
    let loginUrl = LOGIN_URL;
    log.dev(`[AUTH] Starting login - LOGIN_URL constant: ${LOGIN_URL}`);
    
    // Check if we're in Docker and URL contains localhost or host.docker.internal
    // (host.docker.internal might have been set by module-level code but doesn't work in WSL2)
    if (loginUrl && (loginUrl.includes('localhost') || loginUrl.includes('host.docker.internal'))) {
      log.dev(`[AUTH] localhost or host.docker.internal detected in URL: ${loginUrl}`);
      try {
        const isDocker = existsSync('/.dockerenv');
        log.dev(`[AUTH] Docker check result: ${isDocker}`);
        if (isDocker) {
          // In WSL2, host.docker.internal doesn't work, use gateway IP instead
          // Get gateway IP from route table (default route gateway)
          // For this Docker setup, the gateway is 172.21.0.1
          const gatewayIp = '172.21.0.1';
          // Replace both localhost and host.docker.internal with gateway IP
          loginUrl = loginUrl.replace('localhost', gatewayIp).replace('host.docker.internal', gatewayIp);
          log.dev(`[AUTH] ✅ Replaced with gateway IP: ${LOGIN_URL} -> ${loginUrl}`);
        } else {
          log.dev(`[AUTH] Not in Docker, keeping original URL`);
        }
      } catch (e) {
        log.error(`[AUTH] Error checking Docker: ${e}`);
      }
    } else {
      log.dev(`[AUTH] No localhost/host.docker.internal in URL: ${loginUrl}`);
    }
    
    log.dev(`[AUTH] Final login URL: ${loginUrl}`);
    log.dev(`Attempting login to: ${loginUrl}`);
    loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password
      })
    });
  } catch (error) {
    lastError = error as Error;
    const errorMessage = lastError.message || 'Unknown error';
    log.error(`API login failed (network error): ${errorMessage}`);
    log.error(`Failed to connect to: ${LOGIN_URL}`);
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      log.error(`Connection refused - is POPS API running at ${API_BASE_URL}?`);
      log.error(`Note: From Docker container, use host.docker.internal or host IP instead of localhost`);
    }
    return null;
  }

  // If login failed, return null
  if (!loginResponse) {
    log.error(`API endpoint failed: ${API_BASE_URL}`);
    return null;
  }

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    log.error(`Pops API login failed: ${loginResponse.status} - ${errorText}`);
    return null;
  }

  const loginData = await loginResponse.json();

    // Pops JWT response format: { access, refresh, full_name, is_ops_team, is_superuser, is_staff, is_active, is_deliveryq, pia_access, id, email }
    const accessToken = loginData.access;
    const refreshToken = loginData.refresh;

    if (!accessToken) {
      log.error('Pops API response missing access token');
      return null;
    }

    // Check if user has pia_access - using PIA's token system
    const hasPiaAccess = Boolean(loginData.pia_access);

    // Map Pops/Django user data to internal role
    // Pops returns: is_superuser, is_staff, is_ops_team, is_deliveryq, pia_access
    const role = (
      loginData.is_superuser ? UserRole.ADMIN :
        loginData.is_ops_team ? UserRole.MANAGER :
          loginData.is_staff ? UserRole.MANAGER :
            loginData.is_deliveryq ? UserRole.DRIVER :
              UserRole.VIEWER
    );

    return {
      id: String(loginData.id || email),
      username: email,
      email: loginData.email || email,
      role: role,
      employeeId: String(loginData.id || email), // Use user ID as employee ID
      fullName: loginData.full_name || '',
      isOpsTeam: Boolean(loginData.is_ops_team),
      isActive: loginData.is_active !== false,
      isStaff: Boolean(loginData.is_staff),
      isSuperUser: Boolean(loginData.is_superuser),
      piaAccess: hasPiaAccess, // Store pia_access flag
      accessToken,
      refreshToken,
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
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
    // This handles users logged in via Pops API
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
        (req as AuthenticatedRequest).user = user;
        return next();
      }
    } catch (_e) {
      // Continue to token verification if DB check fails
    }

    // 2. Verify JWT token with PIA/POPS backend (using PIA's token system)
    try {
      const verifyResponse = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: accessToken })
      });

      if (verifyResponse.ok) {
        const userData = await verifyResponse.json();
        
        // Find or create user from pops response
        // Try to find by ID first, then by email if needed
        let user = await storage.getUserById(String(userData.id || ''));
        
        if (!user && userData.email) {
          // Try to find by searching users - we'll need to query differently
          // For now, create new user if not found
        }
        
        if (!user) {
          // Create user from pops token data
          const role = (
            userData.is_superuser ? UserRole.ADMIN :
              userData.is_ops_team ? UserRole.MANAGER :
                userData.is_staff ? UserRole.MANAGER :
                  userData.is_deliveryq ? UserRole.DRIVER :
                    UserRole.VIEWER
          );
          
          user = await storage.createUser({
            id: String(userData.id || Date.now()),
            username: userData.email || '',
            email: userData.email || '',
            role: role,
            employeeId: String(userData.id || Date.now()),
            fullName: userData.full_name || '',
            isOpsTeam: Boolean(userData.is_ops_team),
            isActive: userData.is_active !== false,
            isApproved: true,
            isRider: userData.is_deliveryq || false,
            isStaff: Boolean(userData.is_staff),
            isSuperUser: Boolean(userData.is_superuser),
            accessToken: accessToken,
            refreshToken: '', // Not available from verify endpoint
            lastLogin: new Date().toISOString()
          });
        } else {
          // Update existing user with new token
          await storage.updateUser(user.id, { accessToken: accessToken });
        }

        (req as AuthenticatedRequest).user = user;
        return next();
      }
    } catch (_e) {
      // Token verification failed, continue to error
    }

    // 3. Legacy System Check (Disabled for Docker migration)
    if (accessToken.startsWith('local_')) {
      log.warn('Legacy token format detected but legacy DB support is disabled in Docker environment.');
    }

    // 4. Fallback: Token is invalid or expired
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
    // Authenticate with Pops API
    const printoUser = await authenticateWithPrintoAPI(email, password);

    if (!printoUser) {
      throw new Error('Authentication failed with Pops API');
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

// Refresh access token using PIA's token system
export const refreshAccessTokenForUser = async (userId: string, refreshToken: string, piaAccess?: boolean) => {
  try {
    // Use PIA token system - PIA uses /refresh/ endpoint
    const res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken })
    });
    if (!res.ok) {
      log.error(`Token refresh failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const newAccess = data.access;
    if (!newAccess) return null;

    // Update stored access token
    await storage.updateUser(userId, { accessToken: newAccess });
    
    return newAccess;
  } catch (error) {
    log.error('Token refresh error:', error);
    return null;
  }
};

// Helper function to make authenticated requests using PIA's token system
export const makePrintoAPIRequest = async (endpoint: string, accessToken: string, options: RequestInit = {}, piaAccess?: boolean) => {
  // Use PIA/POPS API (same endpoint)
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

    if (!response.ok) {
      throw new Error(`Pops API request failed: ${response.status} ${response.statusText}`);
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
