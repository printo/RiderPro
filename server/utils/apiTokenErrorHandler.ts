import { Request, Response } from 'express';

export enum ApiTokenErrorCode {
  // Database errors
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_INITIALIZATION_FAILED = 'DATABASE_INITIALIZATION_FAILED',
  DATABASE_OPERATION_FAILED = 'DATABASE_OPERATION_FAILED',

  // Authentication errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  TOKEN_DISABLED = 'TOKEN_DISABLED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  TOKEN_NAME_EXISTS = 'TOKEN_NAME_EXISTS',
  INVALID_EXPIRATION_DATE = 'INVALID_EXPIRATION_DATE',

  // System errors
  TOKEN_GENERATION_FAILED = 'TOKEN_GENERATION_FAILED',
  HASH_OPERATION_FAILED = 'HASH_OPERATION_FAILED',
  SYSTEM_UNAVAILABLE = 'SYSTEM_UNAVAILABLE'
}

export interface ApiTokenError {
  code: ApiTokenErrorCode;
  message: string;
  details?: any;
  statusCode: number;
  timestamp: Date;
  requestId?: string;
}

export class ApiTokenErrorHandler {
  private static instance: ApiTokenErrorHandler;
  private errorLog: ApiTokenError[] = [];
  private maxLogSize = 1000;

  private constructor() { }

  static getInstance(): ApiTokenErrorHandler {
    if (!ApiTokenErrorHandler.instance) {
      ApiTokenErrorHandler.instance = new ApiTokenErrorHandler();
    }
    return ApiTokenErrorHandler.instance;
  }

  /**
   * Create a standardized API token error
   */
  createError(
    code: ApiTokenErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    requestId?: string
  ): ApiTokenError {
    const error: ApiTokenError = {
      code,
      message,
      details,
      statusCode,
      timestamp: new Date(),
      requestId
    };

    // Log the error
    this.logError(error);

    return error;
  }

  /**
   * Handle database connection errors
   */
  handleDatabaseError(originalError: Error, operation: string, requestId?: string): ApiTokenError {
    const message = `Database operation '${operation}' failed: ${originalError.message}`;

    let code = ApiTokenErrorCode.DATABASE_OPERATION_FAILED;
    let statusCode = 500;

    // Categorize specific database errors
    if (originalError.message.includes('SQLITE_CANTOPEN') || originalError.message.includes('database is locked')) {
      code = ApiTokenErrorCode.DATABASE_CONNECTION_FAILED;
      statusCode = 503;
    } else if (originalError.message.includes('UNIQUE constraint failed')) {
      code = ApiTokenErrorCode.TOKEN_NAME_EXISTS;
      statusCode = 409;
    }

    return this.createError(code, message, statusCode, {
      originalError: originalError.message,
      operation
    }, requestId);
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(type: 'invalid' | 'expired' | 'revoked' | 'disabled' | 'insufficient', requestId?: string): ApiTokenError {
    const errorMap = {
      invalid: {
        code: ApiTokenErrorCode.INVALID_TOKEN,
        message: 'Invalid or malformed API token',
        statusCode: 401
      },
      expired: {
        code: ApiTokenErrorCode.TOKEN_EXPIRED,
        message: 'API token has expired',
        statusCode: 401
      },
      revoked: {
        code: ApiTokenErrorCode.TOKEN_REVOKED,
        message: 'API token has been revoked',
        statusCode: 401
      },
      disabled: {
        code: ApiTokenErrorCode.TOKEN_DISABLED,
        message: 'API token is disabled',
        statusCode: 401
      },
      insufficient: {
        code: ApiTokenErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Insufficient permissions for this operation',
        statusCode: 403
      }
    };

    const errorInfo = errorMap[type];
    return this.createError(errorInfo.code, errorInfo.message, errorInfo.statusCode, { type }, requestId);
  }

  /**
   * Handle validation errors
   */
  handleValidationError(field: string, reason: string, requestId?: string): ApiTokenError {
    const message = `Validation failed for field '${field}': ${reason}`;
    return this.createError(ApiTokenErrorCode.INVALID_INPUT, message, 400, {
      field,
      reason
    }, requestId);
  }

  /**
   * Handle system errors
   */
  handleSystemError(operation: string, originalError: Error, requestId?: string): ApiTokenError {
    const message = `System error during '${operation}': ${originalError.message}`;

    let code = ApiTokenErrorCode.SYSTEM_UNAVAILABLE;
    if (operation.includes('token generation')) {
      code = ApiTokenErrorCode.TOKEN_GENERATION_FAILED;
    } else if (operation.includes('hash')) {
      code = ApiTokenErrorCode.HASH_OPERATION_FAILED;
    }

    return this.createError(code, message, 500, {
      operation,
      originalError: originalError.message,
      stack: originalError.stack
    }, requestId);
  }

  /**
   * Send error response to client
   */
  sendErrorResponse(res: Response, error: ApiTokenError): void {
    // Don't expose sensitive details in production
    const isProduction = process.env.NODE_ENV === 'production';

    const response: any = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp.toISOString()
      }
    };

    // Include request ID if available
    if (error.requestId) {
      response.error.requestId = error.requestId;
    }

    // Include details only in development
    if (!isProduction && error.details) {
      response.error.details = error.details;
    }

    res.status(error.statusCode).json(response);
  }

  /**
   * Log error for monitoring and debugging
   */
  private logError(error: ApiTokenError): void {
    // Add to in-memory log
    this.errorLog.push(error);

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Console logging with appropriate level
    const logMessage = `[${error.code}] ${error.message}`;

    if (error.statusCode >= 500) {
      console.error('🚨 API Token Error:', logMessage, error.details);
    } else if (error.statusCode >= 400) {
      console.warn('⚠️  API Token Warning:', logMessage);
    } else {
      console.info('ℹ️  API Token Info:', logMessage);
    }

    // In production, you might want to send to external logging service
    if (process.env.NODE_ENV === 'production' && error.statusCode >= 500) {
      // Example: Send to external monitoring service
      // this.sendToMonitoringService(error);
    }
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 50): ApiTokenError[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCode: Record<string, number>;
    byStatusCode: Record<number, number>;
    recentCount: number;
  } {
    const stats = {
      total: this.errorLog.length,
      byCode: {} as Record<string, number>,
      byStatusCode: {} as Record<number, number>,
      recentCount: 0
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    this.errorLog.forEach(error => {
      // Count by error code
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;

      // Count by status code
      stats.byStatusCode[error.statusCode] = (stats.byStatusCode[error.statusCode] || 0) + 1;

      // Count recent errors
      if (error.timestamp > oneHourAgo) {
        stats.recentCount++;
      }
    });

    return stats;
  }

  /**
   * Clear error log (useful for testing)
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Middleware to add request ID to all requests
   */
  static requestIdMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      // Generate unique request ID
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Add to response headers for debugging
      res.setHeader('X-Request-ID', req.requestId);

      next();
    };
  }

  /**
   * Express error handler middleware
   */
  static errorMiddleware() {
    const handler = ApiTokenErrorHandler.getInstance();

    return (error: any, req: Request, res: Response, next: Function) => {
      // If response already sent, delegate to default Express error handler
      if (res.headersSent) {
        return next(error);
      }

      // Handle API token specific errors
      if (error instanceof Error) {
        const apiError = handler.handleSystemError('request_processing', error, req.requestId);
        handler.sendErrorResponse(res, apiError);
      } else {
        // Fallback for unknown error types
        const apiError = handler.createError(
          ApiTokenErrorCode.SYSTEM_UNAVAILABLE,
          'An unexpected error occurred',
          500,
          undefined,
          req.requestId
        );
        handler.sendErrorResponse(res, apiError);
      }
    };
  }
}

// Extend Express Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Export singleton instance
export const apiTokenErrorHandler = ApiTokenErrorHandler.getInstance();