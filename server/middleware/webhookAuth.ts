import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { log } from '../vite.js';
import { webhookConfig } from '../config/webhook.js';

export interface WebhookRequest extends Request {
  webhookSource?: string;
  webhookTimestamp?: number;
}

/**
 * Webhook authentication middleware for external system integration
 * Supports multiple authentication methods: API key, HMAC signature, and basic auth
 */
export class WebhookAuthMiddleware {
  private static readonly WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'riderpro-webhook-secret-2024';
  private static readonly API_KEY_HEADER = 'x-api-key';
  private static readonly SIGNATURE_HEADER = 'x-webhook-signature';
  private static readonly TIMESTAMP_HEADER = 'x-webhook-timestamp';
  private static readonly SOURCE_HEADER = 'x-webhook-source';

  // Valid API keys for external systems (in production, store in database)
  private static readonly VALID_API_KEYS = new Set([
  process.env.PIA_API_KEY || 'printo-api-key-2024',
  process.env.EXTERNAL_API_KEY_1 || 'external-system-key-1',
  process.env.EXTERNAL_API_KEY_2 || 'riderpro-integration-key'
]);

  /**
   * Main webhook authentication middleware
   */
  static authenticate() {
    return (req: WebhookRequest, res: Response, next: NextFunction) => {
      try {
        log(`Webhook authentication attempt from ${req.ip}`, 'webhook-auth');

        // Check for API key authentication first
        const apiKey = req.headers[WebhookAuthMiddleware.API_KEY_HEADER] as string;
        if (apiKey && WebhookAuthMiddleware.validateApiKey(apiKey)) {
          req.webhookSource = req.headers[WebhookAuthMiddleware.SOURCE_HEADER] as string || 'api-key';
          log(`Webhook authenticated via API key from source: ${req.webhookSource}`, 'webhook-auth');
          return next();
        }

        // Check for HMAC signature authentication
        const signature = req.headers[WebhookAuthMiddleware.SIGNATURE_HEADER] as string;
        const timestamp = req.headers[WebhookAuthMiddleware.TIMESTAMP_HEADER] as string;

        if (signature && timestamp) {
          if (WebhookAuthMiddleware.validateHmacSignature(req, signature, timestamp)) {
            req.webhookSource = req.headers[WebhookAuthMiddleware.SOURCE_HEADER] as string || 'hmac';
            req.webhookTimestamp = parseInt(timestamp);
            log(`Webhook authenticated via HMAC signature from source: ${req.webhookSource}`, 'webhook-auth');
            return next();
          }
        }

        // Check for basic authentication
        const authHeader = req.headers.authorization;
        if (authHeader && WebhookAuthMiddleware.validateBasicAuth(authHeader)) {
          req.webhookSource = 'basic-auth';
          log(`Webhook authenticated via basic auth`, 'webhook-auth');
          return next();
        }

        // No valid authentication found
        log(`Webhook authentication failed from ${req.ip}`, 'webhook-auth');
        return res.status(401).json({
          success: false,
          message: 'Webhook authentication required',
          error: 'WEBHOOK_AUTH_REQUIRED',
          timestamp: new Date().toISOString()
        });

      } catch (error: any) {
        log(`Webhook authentication error: ${error.message}`, 'webhook-auth');
        return res.status(500).json({
          success: false,
          message: 'Webhook authentication error',
          error: 'WEBHOOK_AUTH_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Validate API key authentication
   */
  private static validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    return webhookConfig.authentication.apiKeys.includes(apiKey.trim());
  }

  /**
   * Validate HMAC signature authentication
   */
  private static validateHmacSignature(req: Request, signature: string, timestamp: string): boolean {
    try {
      // Check timestamp to prevent replay attacks (5 minute window)
      const now = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp);

      if (Math.abs(now - requestTime) > 300) { // 5 minutes
        log(`Webhook timestamp too old or too new: ${timestamp}`, 'webhook-auth');
        return false;
      }

      // Create expected signature
      const payload = JSON.stringify(req.body);
      const expectedSignature = WebhookAuthMiddleware.createHmacSignature(payload, timestamp);

      // Compare signatures using constant-time comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

    } catch (error: any) {
      log(`HMAC validation error: ${error.message}`, 'webhook-auth');
      return false;
    }
  }

  /**
   * Validate basic authentication
   */
  private static validateBasicAuth(authHeader: string): boolean {
    try {
      if (!authHeader.startsWith('Basic ')) {
        return false;
      }

      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      // Check against valid webhook credentials
      const validCredentials = webhookConfig.authentication.basicAuthCredentials;

      return validCredentials.some(cred =>
        cred.username === username && cred.password === password
      );

    } catch (error: any) {
      log(`Basic auth validation error: ${error.message}`, 'webhook-auth');
      return false;
    }
  }

  /**
   * Create HMAC signature for payload
   */
  static createHmacSignature(payload: string, timestamp: string): string {
    const signaturePayload = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', webhookConfig.authentication.hmacSecret)
      .update(signaturePayload, 'utf8')
      .digest('hex');
  }

  /**
   * Security headers middleware for webhook endpoints
   */
  static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Content-Security-Policy', "default-src 'none'");

      // CORS headers for webhook endpoints
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-webhook-signature, x-webhook-timestamp, x-webhook-source, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      next();
    };
  }

  /**
   * Request logging middleware for webhooks
   */
  static requestLogger() {
    return (req: WebhookRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Log incoming request
      log(`Webhook request: ${req.method} ${req.path} from ${req.ip} (source: ${req.webhookSource || 'unknown'})`, 'webhook-request');

      // Log request headers (excluding sensitive data)
      const safeHeaders = { ...req.headers };
      delete safeHeaders.authorization;
      delete safeHeaders[WebhookAuthMiddleware.API_KEY_HEADER];
      delete safeHeaders[WebhookAuthMiddleware.SIGNATURE_HEADER];

      log(`Webhook headers: ${JSON.stringify(safeHeaders)}`, 'webhook-request');

      // Override res.json to log response
      const originalJson = res.json;
      res.json = function (body: any) {
        const duration = Date.now() - startTime;
        log(`Webhook response: ${res.statusCode} in ${duration}ms (source: ${req.webhookSource || 'unknown'})`, 'webhook-request');

        if (res.statusCode >= 400) {
          log(`Webhook error response: ${JSON.stringify(body)}`, 'webhook-request');
        }

        return originalJson.call(this, body);
      };

      next();
    };
  }

  /**
   * Rate limiting middleware for webhook endpoints
   */
  static rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [key, value] of requests.entries()) {
        if (value.resetTime < windowStart) {
          requests.delete(key);
        }
      }

      // Get or create client record
      let clientRecord = requests.get(clientId);
      if (!clientRecord || clientRecord.resetTime < windowStart) {
        clientRecord = { count: 0, resetTime: now + windowMs };
        requests.set(clientId, clientRecord);
      }

      // Check rate limit
      if (clientRecord.count >= maxRequests) {
        log(`Rate limit exceeded for ${clientId}`, 'webhook-auth');
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((clientRecord.resetTime - now) / 1000),
          timestamp: new Date().toISOString()
        });
      }

      // Increment counter
      clientRecord.count++;

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - clientRecord.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(clientRecord.resetTime / 1000));

      next();
    };
  }

  /**
   * Validate webhook payload size
   */
  static validatePayloadSize(maxSizeBytes: number = 1024 * 1024) { // 1MB default
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');

      if (contentLength > maxSizeBytes) {
        log(`Webhook payload too large: ${contentLength} bytes`, 'webhook-auth');
        return res.status(413).json({
          success: false,
          message: 'Payload too large',
          error: 'PAYLOAD_TOO_LARGE',
          maxSize: maxSizeBytes,
          receivedSize: contentLength,
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }
}

// Export convenience functions
export const webhookAuth = WebhookAuthMiddleware.authenticate();
export const webhookSecurity = WebhookAuthMiddleware.securityHeaders();
export const webhookLogger = WebhookAuthMiddleware.requestLogger();
export const webhookRateLimit = WebhookAuthMiddleware.rateLimit();
export const webhookPayloadLimit = WebhookAuthMiddleware.validatePayloadSize();