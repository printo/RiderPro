import { Request, Response, NextFunction } from 'express';
import { apiTokenService } from '../services/ApiTokenService.js';
import { ApiTokenRequest } from './apiTokenAuth.js';

/**
 * Enhanced API token usage logging middleware
 * This middleware provides comprehensive logging of API token usage
 */
export class ApiTokenLogger {
  private static instance: ApiTokenLogger;
  private requestStartTimes = new Map<string, number>();

  static getInstance(): ApiTokenLogger {
    if (!ApiTokenLogger.instance) {
      ApiTokenLogger.instance = new ApiTokenLogger();
    }
    return ApiTokenLogger.instance;
  }

  /**
   * Middleware to start tracking request timing
   */
  startRequestTracking = (req: ApiTokenRequest, res: Response, next: NextFunction) => {
    if (req.isApiTokenAuth && req.apiToken) {
      const requestId = this.generateRequestId(req);
      this.requestStartTimes.set(requestId, Date.now());

      // Add request ID to request for later reference
      (req as any).requestId = requestId;
    }
    next();
  };

  /**
   * Middleware to log API token usage with comprehensive details
   */
  logTokenUsage = (req: ApiTokenRequest, res: Response, next: NextFunction) => {
    if (req.isApiTokenAuth && req.apiToken) {
      // Override response methods to capture final status and response size
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;

      let responseSize = 0;
      let responseLogged = false;

      const logUsage = async (statusCode?: number, responseBody?: any) => {
        if (responseLogged) return;
        responseLogged = true;

        try {
          const requestId = (req as any).requestId;
          const startTime = requestId ? this.requestStartTimes.get(requestId) : null;
          const duration = startTime ? Date.now() - startTime : null;

          // Calculate response size
          if (responseBody) {
            responseSize = Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
          }

          // Log comprehensive usage data
          await apiTokenService.logTokenUsage(req.apiToken!.id, {
            endpoint: req.originalUrl || req.path,
            method: req.method,
            ipAddress: this.getClientIp(req),
            userAgent: req.get('User-Agent'),
            statusCode: statusCode || res.statusCode
          });

          // Log additional metrics for monitoring
          this.logRequestMetrics({
            tokenId: req.apiToken!.id,
            tokenName: req.apiToken!.name,
            endpoint: req.originalUrl || req.path,
            method: req.method,
            statusCode: statusCode || res.statusCode,
            duration,
            responseSize,
            ipAddress: this.getClientIp(req),
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          });

          // Clean up timing data
          if (requestId) {
            this.requestStartTimes.delete(requestId);
          }
        } catch (error) {
          console.error('Failed to log API token usage:', error);
        }
      };

      // Override res.send
      res.send = function (body: any) {
        logUsage(res.statusCode, body);
        return originalSend.call(this, body);
      };

      // Override res.json
      res.json = function (body: any) {
        logUsage(res.statusCode, body);
        return originalJson.call(this, body);
      };

      // Override res.end
      res.end = function (chunk?: any, encoding?: any) {
        logUsage(res.statusCode, chunk);
        return originalEnd.call(this, chunk, encoding);
      };
    }

    next();
  };

  /**
   * Middleware to handle errors and log failed requests
   */
  logTokenErrors = (error: any, req: ApiTokenRequest, res: Response, next: NextFunction) => {
    if (req.isApiTokenAuth && req.apiToken) {
      // Log error usage
      apiTokenService.logTokenUsage(req.apiToken.id, {
        endpoint: req.originalUrl || req.path,
        method: req.method,
        ipAddress: this.getClientIp(req),
        userAgent: req.get('User-Agent'),
        statusCode: error.status || 500
      }).catch(logError => {
        console.error('Failed to log API token error usage:', logError);
      });

      // Log error details for monitoring
      console.error('API Token Request Error:', {
        tokenId: req.apiToken.id,
        tokenName: req.apiToken.name,
        endpoint: req.originalUrl || req.path,
        method: req.method,
        error: error.message || error,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }

    next(error);
  };

  /**
   * Get client IP address with proxy support
   */
  private getClientIp(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown'
    );
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(req: Request): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Log detailed request metrics for monitoring and analytics
   */
  private logRequestMetrics(metrics: {
    tokenId: number;
    tokenName: string;
    endpoint: string;
    method: string;
    statusCode: number;
    duration: number | null;
    responseSize: number;
    ipAddress: string;
    userAgent?: string;
    timestamp: string;
  }) {
    // In production, this could send to monitoring services like DataDog, New Relic, etc.
    console.log('API Token Metrics:', {
      ...metrics,
      duration: metrics.duration ? `${metrics.duration}ms` : 'unknown',
      responseSize: `${metrics.responseSize} bytes`
    });

    // Could also store in a separate metrics table for analytics
    // or send to external monitoring services
  }

  /**
   * Get usage statistics for monitoring dashboard
   */
  async getUsageStatistics(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day') {
    try {
      // This would typically query a metrics database
      // For now, we'll return mock data structure
      return {
        timeframe,
        totalRequests: 0,
        uniqueTokens: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topEndpoints: [],
        statusCodeDistribution: {},
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get usage statistics:', error);
      return null;
    }
  }

  /**
   * Clean up old request timing data to prevent memory leaks
   */
  cleanupOldRequests() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [requestId, startTime] of this.requestStartTimes.entries()) {
      if (now - startTime > maxAge) {
        this.requestStartTimes.delete(requestId);
      }
    }
  }
}

// Export singleton instance and middleware functions
export const apiTokenLogger = ApiTokenLogger.getInstance();

// Convenience middleware exports
export const startRequestTracking = apiTokenLogger.startRequestTracking;
export const logTokenUsage = apiTokenLogger.logTokenUsage;
export const logTokenErrors = apiTokenLogger.logTokenErrors;

// Periodic cleanup of old request data
setInterval(() => {
  apiTokenLogger.cleanupOldRequests();
}, 60000); // Clean up every minute