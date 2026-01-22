import type { Express } from "express";
import bcrypt from "bcrypt";
import Database from 'better-sqlite3';
import path from 'path';
import { authenticate, AuthenticatedRequest } from "../middleware/auth.js";
import { log } from "../../shared/utils/logger.js";

// Create userdata database connection for authentication
const userDataDbPath = path.join(process.cwd(), 'data', 'userdata.db');
const userDataDb = new Database(userDataDbPath);

export function registerUserManagementRoutes(app: Express): void {
  // User Management API endpoints
  app.get('/api/auth/all-users', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      // Only admin users can access all users
      if (!req.user?.isSuperUser && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const users = userDataDb
        .prepare(`
          SELECT id, rider_id, full_name, role, is_approved, created_at, last_login_at, approved_at, is_super_user, is_ops_team, is_staff
          FROM rider_accounts 
          ORDER BY created_at DESC
        `)
        .all();

      res.json({
        success: true,
        users
      });
    } catch (error: any) {
      log.error('Error fetching all users:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  });

  app.patch('/api/auth/users/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      // Only admin users can update users
      if (!req.user?.isSuperUser && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const { userId } = req.params;
      const { role, isApproved, fullName, isSuperUser, isOpsTeam, isStaff } = req.body;

      // Build update query dynamically based on provided fields
      const updates: string[] = [];
      const values: any[] = [];

      if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
      }

      if (isApproved !== undefined) {
        updates.push('is_approved = ?');
        values.push(isApproved === true ? 1 : (isApproved === false ? 0 : isApproved));
      }

      if (fullName !== undefined) {
        updates.push('full_name = ?');
        values.push(fullName);
      }

      if (isSuperUser !== undefined) {
        updates.push('is_super_user = ?');
        values.push(isSuperUser ? 1 : 0);
      }

      if (isOpsTeam !== undefined) {
        updates.push('is_ops_team = ?');
        values.push(isOpsTeam ? 1 : 0);
      }

      if (isStaff !== undefined) {
        updates.push('is_staff = ?');
        values.push(isStaff ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update'
        });
      }

      // Add updated timestamp
      updates.push('updated_at = datetime(\'now\')');
      values.push(userId);

      const query = `UPDATE rider_accounts SET ${updates.join(', ')} WHERE id = ?`;
      const result = userDataDb.prepare(query).run(...values);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Fetch updated user
      const updatedUser = userDataDb
        .prepare('SELECT id, rider_id, full_name, role, is_approved, created_at, last_login_at FROM rider_accounts WHERE id = ?')
        .get(userId);

      log.info('User updated by admin user:', { userId, updates: req.body, updatedBy: req.user?.id });

      res.json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error: any) {
      log.error('Error updating user:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  });

  app.post('/api/auth/users/:userId/reset-password', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      // Only admin users can reset passwords
      if (!req.user?.isSuperUser && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      const result = userDataDb
        .prepare(`
          UPDATE rider_accounts 
          SET password_hash = ?, updated_at = datetime('now')
          WHERE id = ?
        `)
        .run(hashedPassword, userId);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      log.info('Password reset by admin user:', { userId, resetBy: req.user?.id });

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