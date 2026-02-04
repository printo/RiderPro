// Frontend Configuration (TypeScript version)
// Environment is determined by package.json scripts (NODE_ENV or APP_ENV)

type Environment = 'development' | 'production';

interface AppConfig {
  app: {
    port: number;
    domain: string;
  };
  api: {
    baseUrl: string;
  };
  logging: {
    enableConsole: boolean;
    level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  };
  debug: boolean;
}

const env: Environment = (process.env.NODE_ENV as Environment) || 
  (process.env.APP_ENV as Environment) || 
  'development';

const development: AppConfig = {
  app: {
    port: 5004,
    domain: 'http://localhost:5004',
  },
  api: {
    // Empty string = use relative URLs (Vite proxy handles /api → http://django:8000)
    baseUrl: '',
    // For standalone frontend builds, set to full URL
    // baseUrl: 'http://localhost:8004/api',
  },
  logging: {
    enableConsole: true,
    level: 'DEBUG',
  },
  debug: true,
};

const production: AppConfig = {
  app: {
    port: 5004,
    domain: 'https://riderpro.printo.in',
  },
  api: {
    // In production, use relative URLs (Nginx handles routing)
    baseUrl: '',
    // Or set to full API URL if needed
    // baseUrl: 'https://riderpro.printo.in/api',
  },
  logging: {
    enableConsole: false,
    level: 'ERROR', // Only show errors in production
  },
  debug: false,
};

const configs: Record<Environment, AppConfig> = {
  development,
  production,
};

// Default to development if env doesn't match
export const config: AppConfig = configs[env] || configs.development;

export default config;

