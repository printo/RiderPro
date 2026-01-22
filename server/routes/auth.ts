import type { Express } from "express";
import bcrypt from "bcrypt";
import Database from 'better-sqlite3';
import path from 'path';
import { authenticate, AuthenticatedRequest, authenticateUser } from "../middleware/auth.js";
import { log } from "../../shared/utils/logger.js";

// Create userdata database connection for authentication
const userDataDbPath = path.join(process.cwd(), 'data', 'userdata.db');
const userDataDb = new Database(userDataDbPath);

export function registerAuthRoutes(app: Express): void {
  // Local user registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { riderId, password, fullName } = req.body;

      if (!riderId || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: riderId, password, fullName'
        });
      }

      // Check if user already exists
      const existingUser = userDataDb.prepare('SELECT * FROM rider_accounts WHERE rider_id = ?').get(riderId);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this rider ID already exists'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert new user (pending approval)
      const insertUser = userDataDb.prepare(`
        INSERT INTO rider_accounts (rider_id, password_hash, full_name, is_approved, is_active, created_at)
        VALUES (?, ?, ?, 0, 1, datetime('now'))
      `);

      const result = insertUser.run(riderId, hashedPassword, fullName);

      log.info('New user registered:', { riderId, fullName, status: 'pending' });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Awaiting admin approval.',
        userId: result.lastInsertRowid
      });
    } catch (error: any) {
      log.error('Registration error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  });

  // Printo API Authentication (Proxy to avoid CORS)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID/Email and password are required'
        });
      }

      const user = await authenticateUser(email, password);

      res.json({
        success: true,
        message: 'Login successful',
        access: user.accessToken,
        refresh: user.refreshToken,
        full_name: user.fullName,
        is_staff: user.role === 'manager' || user.role === 'admin' || user.isStaff,
        is_super_user: user.role === 'admin' || user.isSuperUser,
        is_ops_team: user.isOpsTeam,
        employee_id: user.employeeId
      });
    } catch (error: any) {
      log.error('Printo login error:', error);
      res.status(401).json({
        success: false,
        message: 'Login failed: ' + (error.message || 'Invalid credentials')
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
          message: 'Missing riderId or password'
        });
      }

      // Get user from database
      const user = userDataDb.prepare('SELECT * FROM rider_accounts WHERE rider_id = ?').get(riderId) as any;

      if (!user) {
        log.warn('Login attempt for non-existent user:', riderId);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        log.warn('Invalid password attempt for user:', riderId);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is approved
      if (user.is_approved !== 1) {
        return res.status(403).json({
          success: false,
          message: 'Account pending approval or access denied'
        });
      }

      // Update last login
      userDataDb.prepare('UPDATE rider_accounts SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

      log.info('Successful login:', { riderId, userId: user.id });

      const isSuperUser = Boolean(user.is_super_user) || user.role === 'super_user' || user.role === 'admin';
      const isOpsTeam = Boolean(user.is_ops_team) || user.role === 'ops_team' || user.role === 'admin' || user.role === 'manager';
      const isStaff = Boolean(user.is_staff) || user.role === 'staff' || user.role === 'admin' || user.role === 'manager';

      res.json({
        success: true,
        message: 'Login successful',
        accessToken: `local_${Date.now()}_${user.id}`,
        refreshToken: `local_refresh_${Date.now()}_${user.id}`,
        full_name: user.full_name,
        is_staff: isStaff,
        is_super_user: isSuperUser,
        is_ops_team: isOpsTeam,
        employee_id: user.rider_id,
        role: user.role || 'rider'
      });
    } catch (error: any) {
      log.error('Login error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  });

  // Get pending approvals (for admin)
  app.get('/api/auth/pending-approvals', async (req, res) => {
    try {
      const pendingUsers = userDataDb
        .prepare('SELECT id, rider_id, full_name, created_at FROM rider_accounts WHERE is_approved = 0')
        .all();

      res.json({
        success: true,
        users: pendingUsers
      });
    } catch (error: any) {
      log.error('Error fetching pending approvals:', error.message);
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
      const { role = 'rider' } = req.body;

      // Map roles to flags if needed
      const isSuperUser = role === 'admin' || role === 'super_user' ? 1 : 0;

      const result = userDataDb
        .prepare('UPDATE rider_accounts SET is_approved = 1, role = ?, is_super_user = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(role, isSuperUser, userId);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      log.info('User approved:', { userId, role });

      res.json({
        success: true,
        message: 'User approved successfully'
      });
    } catch (error: any) {
      log.error('Error approving user:', error.message);
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
      const { reason } = req.body;

      const result = userDataDb
        .prepare('UPDATE rider_accounts SET is_approved = -1, updated_at = datetime(\'now\') WHERE id = ?')
        .run(userId);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      log.info('User rejected:', { userId, reason });

      res.json({
        success: true,
        message: 'User rejected successfully'
      });
    } catch (error: any) {
      log.error('Error rejecting user:', error.message);
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

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      const result = userDataDb
        .prepare('UPDATE rider_accounts SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(hashedPassword, userId);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      log.info('Password reset for user:', { userId });

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error: any) {
      log.error('Error resetting password:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  });
}