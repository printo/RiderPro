/**
 * Webhook configuration for external system integration
 */

export interface WebhookConfig {
  authentication: {
    methods: ('api-key' | 'hmac' | 'basic-auth')[];
    apiKeys: string[];
    hmacSecret: string;
    basicAuthCredentials: Array<{ username: string; password: string }>;
  };
  security: {
    maxPayloadSize: number;
    allowedIPs?: string[];
    requireHttps: boolean;
    corsOrigins: string[];
  };
  rateLimit: {
    maxRequests: number;
    windowMs: number;
    skipSuccessfulRequests: boolean;
  };
  logging: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logHeaders: boolean;
    logPayload: boolean;
  };
}

export const webhookConfig: WebhookConfig = {
  authentication: {
    methods: ['api-key', 'hmac', 'basic-auth'],
    apiKeys: [
      process.env.PRINTO_API_KEY || 'printo-api-key-2024',
      process.env.EXTERNAL_API_KEY || 'external-system-key-1',
      process.env.RIDERPRO_INTEGRATION_KEY || 'riderpro-integration-key'
    ],
    hmacSecret: process.env.WEBHOOK_SECRET || 'riderpro-webhook-secret-2024',
    basicAuthCredentials: [
      {
        username: process.env.WEBHOOK_USERNAME || 'riderpro',
        password: process.env.WEBHOOK_PASSWORD || 'webhook-2024'
      },
      {
        username: process.env.PRINTO_USERNAME || 'printo',
        password: process.env.PRINTO_PASSWORD || 'integration-key'
      }
    ]
  },
  security: {
    maxPayloadSize: parseInt(process.env.WEBHOOK_MAX_PAYLOAD_SIZE || '1048576'), // 1MB
    allowedIPs: process.env.WEBHOOK_ALLOWED_IPS?.split(',').map(ip => ip.trim()),
    requireHttps: process.env.NODE_ENV === 'production',
    corsOrigins: process.env.WEBHOOK_CORS_ORIGINS?.split(',').map(origin => origin.trim()) || []
  },
  rateLimit: {
    maxRequests: parseInt(process.env.WEBHOOK_RATE_LIMIT || '100'),
    windowMs: parseInt(process.env.WEBHOOK_RATE_WINDOW || '60000'), // 1 minute
    skipSuccessfulRequests: false
  },
  logging: {
    enabled: process.env.WEBHOOK_LOGGING !== 'false',
    logLevel: (process.env.WEBHOOK_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    logHeaders: process.env.WEBHOOK_LOG_HEADERS === 'true',
    logPayload: process.env.WEBHOOK_LOG_PAYLOAD === 'true' && process.env.NODE_ENV !== 'production'
  }
};

/**
 * Webhook endpoint configuration
 */
export const webhookEndpoints = {
  receive: {
    path: '/api/shipments/receive',
    methods: ['POST'],
    authentication: true,
    rateLimit: true,
    logging: true,
    description: 'Receive shipment data from external systems'
  },
  updateExternal: {
    path: '/api/shipments/update/external',
    methods: ['POST'],
    authentication: false, // Internal endpoint
    rateLimit: false,
    logging: true,
    description: 'Send shipment updates to external systems'
  },
  updateExternalBatch: {
    path: '/api/shipments/update/external/batch',
    methods: ['POST'],
    authentication: false, // Internal endpoint
    rateLimit: false,
    logging: true,
    description: 'Send batch shipment updates to external systems'
  }
};

/**
 * Get webhook configuration for specific environment
 */
export function getWebhookConfig(environment?: string): WebhookConfig {
  const env = environment || process.env.NODE_ENV || 'development';

  const config = { ...webhookConfig };

  // Environment-specific overrides
  if (env === 'production') {
    config.security.requireHttps = true;
    config.logging.logPayload = false;
    config.rateLimit.maxRequests = 50; // Stricter in production
  } else if (env === 'development') {
    config.security.requireHttps = false;
    config.logging.logPayload = true;
    config.rateLimit.maxRequests = 1000; // More lenient in development
  }

  return config;
}

/**
 * Validate webhook configuration
 */
export function validateWebhookConfig(config: WebhookConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.authentication.apiKeys.length) {
    errors.push('At least one API key must be configured');
  }

  if (!config.authentication.hmacSecret) {
    errors.push('HMAC secret must be configured');
  }

  if (config.security.maxPayloadSize <= 0) {
    errors.push('Max payload size must be greater than 0');
  }

  if (config.rateLimit.maxRequests <= 0) {
    errors.push('Rate limit max requests must be greater than 0');
  }

  if (config.rateLimit.windowMs <= 0) {
    errors.push('Rate limit window must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}