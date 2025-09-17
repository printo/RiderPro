import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  authenticateUser,
  UserRole,
  authenticate,
  authorize,
  Permission,
  AuthenticatedRequest,
  getUserPermissions,
  cleanupExpiredSessions
} from '../middleware/auth.js';
import { refreshAccessTokenForUser } from '../middleware/auth.js';
import { auditAuthEvent, AuditEventType, logAuditEvent } from '../middleware/audit';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login endpoint - uses Printo API
router.post('/login', authLimiter, auditAuthEvent(AuditEventType.LOGIN), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const user = await authenticateUser(email, password);

    // Log successful login
    logAuditEvent({
      eventType: AuditEventType.LOGIN,
      action: 'user_login',
      success: true,
      userId: user.id,
      username: user.username,
      details: {
        loginMethod: 'printo_api',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    res.json({
      success: true,
      data: {
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId,
          fullName: user.fullName,
          is_ops_team: (user as any).isOpsTeam,
          permissions: getUserPermissions((user.role as any) === 'admin' ? UserRole.ADMIN : (user.role as any) === 'manager' ? UserRole.MANAGER : (user.role as any) === 'driver' ? UserRole.DRIVER : UserRole.VIEWER)
        }
      }
    });
  } catch (error) {
    // Log failed login
    logAuditEvent({
      eventType: AuditEventType.LOGIN_FAILED,
      action: 'failed_login_attempt',
      success: false,
      username: req.body.email,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    res.status(401).json({
      success: false,
      message: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }
});

// Refresh endpoint: client sends current access (optional) and refresh; server returns new access
router.post('/refresh', async (req, res) => {
  try {
    const { userId, refresh } = req.body || {};
    if (!userId || !refresh) {
      return res.status(400).json({ success: false, message: 'userId and refresh required', code: 'MISSING_PARAMS' });
    }
    const newAccess = await refreshAccessTokenForUser(userId, refresh);
    if (!newAccess) {
      return res.status(401).json({ success: false, message: 'Refresh failed', code: 'REFRESH_FAILED' });
    }
    return res.json({ success: true, data: { accessToken: newAccess } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Refresh error', code: 'REFRESH_ERROR' });
  }
});

// Logout endpoint
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // In a more sophisticated implementation, you would invalidate the token
    // For now, we'll just clean up expired sessions
    cleanupExpiredSessions();

    logAuditEvent({
      eventType: AuditEventType.LOGOUT,
      action: 'user_logout',
      success: true,
      userId: req.user?.id,
      username: req.user?.username,
      details: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      code: 'LOGOUT_FAILED'
    });
  }
});

// Get current user info
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const permissions = getUserPermissions(req.user!.role as UserRole);

    res.json({
      success: true,
      data: {
        user: {
          id: req.user!.id,
          username: req.user!.username,
          email: req.user!.email,
          role: req.user!.role,
          employeeId: req.user!.employeeId,
          fullName: req.user!.fullName,
          accessToken: req.user!.accessToken,
          permissions
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user info',
      code: 'USER_INFO_FAILED'
    });
  }
});

// Get user permissions
router.get('/permissions', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const permissions = getUserPermissions(req.user!.role as UserRole);

    res.json({
      success: true,
      data: {
        permissions,
        role: req.user!.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get permissions',
      code: 'PERMISSIONS_FAILED'
    });
  }
});

// Cleanup expired sessions (internal endpoint)
router.post('/cleanup-sessions',
  authenticate,
  authorize(Permission.CONFIGURE_SYSTEM),
  (_req: AuthenticatedRequest, res: Response) => {
    try {
      cleanupExpiredSessions();

      res.json({
        success: true,
        message: 'Expired sessions cleaned up'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Session cleanup failed',
        code: 'CLEANUP_FAILED'
      });
    }
  }
);

export default router;