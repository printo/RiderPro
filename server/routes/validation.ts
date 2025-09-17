import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, Permission, AuthenticatedRequest } from '../middleware/auth.js';
import SystemValidationService from '../services/SystemValidationService.js';
import { storage } from '../storage';

const router = Router();

// Initialize validation service
const validationService = SystemValidationService.getInstance(storage.getDatabase());

// Run full system validation (Admin only)
router.post('/full', authenticate, authorize(Permission.CONFIGURE_SYSTEM), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    console.log('🔍 Starting full system validation...');

    const report = await validationService.runFullValidation();

    res.json({
      success: true,
      data: {
        report,
        textReport: validationService.generateValidationReport(report)
      }
    });
  } catch (error) {
    console.error('System validation failed:', error);
    res.status(500).json({
      success: false,
      message: 'System validation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

// Validate specific component (Admin only)
router.post('/component/:component', authenticate, authorize(Permission.CONFIGURE_SYSTEM), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { component } = req.params;

    if (!['shipments', 'route_tracking', 'performance'].includes(component)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid component. Must be one of: shipments, route_tracking, performance'
      });
    }

    console.log(`🔍 Validating component: ${component}`);

    const result = await validationService.validateSpecificComponent(component as any);

    res.json({
      success: true,
      data: {
        component,
        result
      }
    });
  } catch (error) {
    console.error(`Component validation failed for ${req.params.component}:`, error);
    res.status(500).json({
      success: false,
      message: 'Component validation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

// Get system health status (Manager and Admin)
router.get('/health', authenticate, authorize(Permission.VIEW_ANALYTICS), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Quick health check without full validation
    const healthStatus = {
      timestamp: new Date().toISOString(),
      database: 'unknown',
      routeTracking: 'unknown',
      performance: 'unknown'
    };

    // Quick database check
    try {
      storage.prepare('SELECT 1').get();
      healthStatus.database = 'healthy';
    } catch (error) {
      healthStatus.database = 'unhealthy';
    }

    // Quick route tracking check
    try {
      if (storage.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='route_sessions'").get()) {
        healthStatus.routeTracking = 'available';
      } else {
        healthStatus.routeTracking = 'not_configured';
      }
    } catch (error) {
      healthStatus.routeTracking = 'error';
    }

    // Quick performance check
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    healthStatus.performance = memUsageMB < 200 ? 'good' : memUsageMB < 400 ? 'moderate' : 'poor';

    res.json({
      success: true,
      data: {
        status: 'operational',
        checks: healthStatus
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

// Get validation history (Admin only)
router.get('/history', authenticate, authorize(Permission.CONFIGURE_SYSTEM), (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // This would typically fetch from a validation_history table
    // For now, return empty history as we're not storing validation results
    res.json({
      success: true,
      data: {
        history: [],
        message: 'Validation history not implemented - results are not persisted'
      }
    });
  } catch (error) {
    console.error('Failed to get validation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get validation history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as any);

export default router;