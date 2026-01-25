import type { Express } from "express";
import { authenticateUser } from "../middleware/auth.js";
import { log } from "../../shared/utils/logger.js";

export function registerAuthRoutes(app: Express): void {
  // Local user registration removed as userdata.db is deprecated

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
    } catch (error) {
      log.error('Printo login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid credentials';
      res.status(401).json({
        success: false,
        message: 'Login failed: ' + errorMessage
      });
    }
  });

  // Local user login removed as userdata.db is deprecated
  // Get pending approvals removed as userdata.db is deprecated
  // Approve user removed as userdata.db is deprecated
  // Reject user removed as userdata.db is deprecated
  // Reset user password removed as userdata.db is deprecated
}
