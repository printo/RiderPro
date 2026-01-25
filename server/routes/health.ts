import type { Express } from "express";
import { log } from "../../shared/utils/logger.js";

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  cached: boolean;
}

export function registerHealthRoutes(app: Express): void {
  // Health check endpoint for connectivity monitoring with caching and rate limiting
  let healthCheckCache: { data: HealthData; timestamp: number } | null = null;
  const HEALTH_CHECK_CACHE_TTL = 10000; // 10 seconds cache
  const healthCheckRateLimit = new Map<string, { count: number; resetTime: number }>();
  const HEALTH_CHECK_RATE_LIMIT = 10; // 10 requests per minute per IP
  const HEALTH_CHECK_RATE_WINDOW = 60000; // 1 minute window

  app.get('/api/health', (req, res) => {
    const now = Date.now();
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Rate limiting check
    const rateLimitKey = `health_${clientIP}`;
    const rateLimitData = healthCheckRateLimit.get(rateLimitKey);

    if (rateLimitData) {
      if (now > rateLimitData.resetTime) {
        // Reset the counter
        healthCheckRateLimit.set(rateLimitKey, { count: 1, resetTime: now + HEALTH_CHECK_RATE_WINDOW });
      } else if (rateLimitData.count >= HEALTH_CHECK_RATE_LIMIT) {
        // Rate limit exceeded
        res.set('Retry-After', Math.ceil((rateLimitData.resetTime - now) / 1000).toString());
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many health check requests. Please slow down.',
          retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000)
        });
      } else {
        // Increment counter
        rateLimitData.count++;
      }
    } else {
      // First request from this IP
      healthCheckRateLimit.set(rateLimitKey, { count: 1, resetTime: now + HEALTH_CHECK_RATE_WINDOW });
    }

    // Return cached response if still valid
    if (healthCheckCache && (now - healthCheckCache.timestamp) < HEALTH_CHECK_CACHE_TTL) {
      res.set('Cache-Control', 'public, max-age=10');
      res.set('X-Health-Cache', 'HIT');
      return res.status(200).json({ ...healthCheckCache.data, cached: true });
    }

    // Generate new response and cache it
    const healthData: HealthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cached: false
    };

    healthCheckCache = {
      data: healthData,
      timestamp: now
    };

    res.set('Cache-Control', 'public, max-age=10');
    res.set('X-Health-Cache', 'MISS');
    res.status(200).json(healthData);
  });

  // Error logging endpoint
  app.post('/api/errors', async (req, res) => {
    try {
      // Log error (in production, would save to monitoring service)
      log.error('Client error reported:', req.body);
      res.status(201).json({ success: true, message: 'Error logged' });
    } catch (error: unknown) {
      const message = (error instanceof Error) ? error.message : String(error);
      log.error('Failed to log client error:', message);
      res.status(500).json({ success: false, message: 'Failed to log error' });
    }
  });
}