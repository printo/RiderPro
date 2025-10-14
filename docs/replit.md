# RiderPro on Replit

## Overview

RiderPro can be deployed and run on Replit for development, testing, and demonstration purposes. This guide covers setup, configuration, and deployment on the Replit platform.

## Quick Deploy

[![Run on Replit](https://replit.com/badge/github/your-org/riderpro)](https://replit.com/new/github/your-org/riderpro)

## Setup Instructions

### 1. Fork or Import Repository

#### Option A: Fork from GitHub
1. Go to [Replit](https://replit.com)
2. Click "Create Repl"
3. Select "Import from GitHub"
4. Enter repository URL: `https://github.com/your-org/riderpro`
5. Click "Import from GitHub"

#### Option B: Upload Files
1. Create a new Node.js Repl
2. Upload the project files
3. Install dependencies

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Replit Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# API Configuration
VITE_API_BASE_URL=https://your-repl-name.your-username.repl.co/api
VITE_AUTH_BASE_URL=https://pia.printo.in/api/v1

# GPS Configuration
VITE_GPS_UPDATE_INTERVAL=30000
VITE_SYNC_INTERVAL=60000

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_GPS_TRACKING=true
VITE_ENABLE_ANALYTICS=true

# External API
PRINTO_API_BASE_URL=https://pia.printo.in/api/v1
API_TIMEOUT=10000

# Security (use Replit Secrets for production)
CORS_ORIGINS=https://your-repl-name.your-username.repl.co
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### 3. Replit Secrets Configuration

For sensitive data, use Replit Secrets instead of `.env`:

1. Open your Repl
2. Click on "Secrets" tab in the sidebar
3. Add the following secrets:

```
JWT_SECRET=your-jwt-secret-key
PRINTO_API_KEY=your-printo-api-key (if required)
DATABASE_URL=your-database-url (if using external DB)
```

### 4. Package.json Configuration

Ensure your `package.json` has the correct scripts for Replit:

```json
{
  "name": "riderpro",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "client": "vite --host 0.0.0.0 --port 5000",
    "server": "tsx watch server/index.ts",
    "build": "vite build",
    "start": "node dist/server/index.js",
    "replit": "npm run dev"
  },
  "main": "server/index.ts"
}
```

### 5. Replit Configuration File

Create a `.replit` file in the root:

```toml
# Replit Configuration
run = "npm run replit"
entrypoint = "server/index.ts"

[packager]
language = "nodejs"

[packager.features]
packageSearch = true
guessImports = true
enabledForHosting = false

[languages.javascript]
pattern = "**/{*.js,*.jsx,*.ts,*.tsx}"

[languages.javascript.languageServer]
start = "typescript-language-server --stdio"

[env]
XDG_CONFIG_HOME = "/home/runner/.config"
PATH = "/home/runner/$REPL_SLUG/.config/npm/node_global/bin:/home/runner/$REPL_SLUG/node_modules/.bin"
npm_config_prefix = "/home/runner/$REPL_SLUG/.config/npm/node_global"

[gitHubImport]
requiredFiles = [".replit", "replit.nix", ".config"]

[deployment]
run = ["sh", "-c", "npm run build && npm start"]
deploymentTarget = "cloudrun"

[nix]
channel = "stable-22_11"

[unitTest]
language = "nodejs"

[debugger]
support = true

[debugger.interactive]
transport = "localhost:0"
startCommand = ["dap-node"]

[debugger.interactive.initializeMessage]
command = "initialize"
type = "request"

[debugger.interactive.launchMessage]
command = "launch"
type = "request"
```

### 6. Nix Configuration

Create a `replit.nix` file for system dependencies:

```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.typescript
    pkgs.nodePackages.tsx
    pkgs.nodePackages.npm
    pkgs.git
  ];
}
```

## Development Workflow

### Starting the Application

1. Open your Repl
2. Click the "Run" button or use the command:
   ```bash
   npm run replit
   ```
3. The application will start on port 3000
4. Replit will provide a URL like: `https://your-repl-name.your-username.repl.co`

### Development Features

#### Hot Reload
- Frontend changes automatically reload
- Backend changes restart the server
- No manual refresh needed

#### Console Access
- Use the Replit console for debugging
- View server logs in real-time
- Run npm commands directly

#### File Management
- Edit files directly in Replit editor
- Upload files via drag-and-drop
- Version control with Git integration

### Testing GPS Functionality

Since Replit runs in a browser environment, GPS testing has limitations:

#### Browser GPS Simulation
1. Open browser developer tools
2. Go to "Sensors" or "Location" tab
3. Set custom GPS coordinates
4. Test GPS tracking features

#### Mock GPS Data
For development, use mock GPS coordinates:

```typescript
// In development mode, use mock GPS data
const mockGPSCoordinates = [
  { latitude: 40.7128, longitude: -74.0060 }, // New York
  { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles
  { latitude: 41.8781, longitude: -87.6298 }  // Chicago
];

if (process.env.NODE_ENV === 'development') {
  // Use mock coordinates for testing
  navigator.geolocation.getCurrentPosition = (success) => {
    const mockPosition = {
      coords: {
        latitude: mockGPSCoordinates[0].latitude,
        longitude: mockGPSCoordinates[0].longitude,
        accuracy: 10
      },
      timestamp: Date.now()
    };
    success(mockPosition);
  };
}
```

## Deployment Options

### Replit Hosting (Free Tier)

Basic hosting for development and testing:

1. Click "Deploy" in your Repl
2. Choose "Autoscale" deployment
3. Configure custom domain (optional)
4. Deploy application

**Limitations:**
- Limited uptime on free tier
- Slower performance
- No custom SSL certificates

### Replit Hosting (Paid Tier)

Enhanced hosting for production use:

1. Upgrade to Replit Pro
2. Configure production environment
3. Set up custom domain
4. Enable SSL certificates
5. Configure monitoring

**Benefits:**
- 24/7 uptime
- Better performance
- Custom domains
- SSL certificates
- Monitoring and analytics

### External Deployment

Export from Replit to other platforms:

#### Heroku Deployment
```bash
# Install Heroku CLI in Replit
npm install -g heroku

# Login to Heroku
heroku login

# Create Heroku app
heroku create riderpro-app

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set PRINTO_API_BASE_URL=https://pia.printo.in/api/v1

# Deploy
git push heroku main
```

#### Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod
```

#### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway deploy
```

## Performance Optimization

### Replit-Specific Optimizations

#### Reduce Bundle Size
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  }
});
```

#### Enable Compression
```typescript
// server/index.ts
import compression from 'compression';

app.use(compression());
```

#### Optimize Images
```bash
# Install image optimization
npm install sharp

# Use in build process
npm run build:optimize
```

### Memory Management

Monitor memory usage in Replit:

```typescript
// Memory monitoring
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: Math.round(used.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB'
  });
}, 30000); // Every 30 seconds
```

## Troubleshooting

### Common Issues

#### Port Configuration
```bash
# Ensure correct port binding
PORT=3000 npm run dev
```

#### CORS Issues
```typescript
// server/index.ts
app.use(cors({
  origin: [
    'https://your-repl-name.your-username.repl.co',
    'http://localhost:5000'
  ],
  credentials: true
}));
```

#### Environment Variables
```bash
# Check environment variables
echo $NODE_ENV
echo $PORT
```

#### GPS Permissions
```javascript
// Request GPS permissions explicitly
if ('geolocation' in navigator) {
  navigator.permissions.query({ name: 'geolocation' })
    .then(result => {
      console.log('GPS permission:', result.state);
    });
}
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment
DEBUG=riderpro:* npm run dev
```

```typescript
// Use debug logging
import debug from 'debug';
const log = debug('riderpro:gps');

log('GPS position updated:', position);
```

### Performance Issues

#### Check Resource Usage
```bash
# Monitor CPU and memory
top
htop
```

#### Optimize Database Queries
```typescript
// Use connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Limit connections on Replit
});
```

#### Enable Caching
```typescript
// Simple memory cache
const cache = new Map();

app.get('/api/shipments', (req, res) => {
  const cacheKey = JSON.stringify(req.query);
  
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  
  // Fetch data and cache
  const data = fetchShipments(req.query);
  cache.set(cacheKey, data);
  
  res.json(data);
});
```

## Security Considerations

### Replit Security Best Practices

#### Use Secrets for Sensitive Data
```bash
# Never commit sensitive data
# Use Replit Secrets instead
const apiKey = process.env.PRINTO_API_KEY; // From Replit Secrets
```

#### Validate Input
```typescript
import joi from 'joi';

const shipmentSchema = joi.object({
  customerName: joi.string().required(),
  address: joi.string().required(),
  type: joi.string().valid('delivery', 'pickup').required()
});

app.post('/api/shipments', (req, res) => {
  const { error, value } = shipmentSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  
  // Process validated data
});
```

#### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### HTTPS Configuration

Replit provides HTTPS by default, but ensure all external API calls use HTTPS:

```typescript
// Always use HTTPS for external APIs
const PRINTO_API_BASE = 'https://pia.printo.in/api/v1';

// Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

## Monitoring and Analytics

### Basic Monitoring

```typescript
// Simple uptime monitoring
let startTime = Date.now();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});
```

### Error Tracking

```typescript
// Error logging
app.use((error, req, res, next) => {
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});
```

### Usage Analytics

```typescript
// Simple analytics
const analytics = {
  requests: 0,
  errors: 0,
  users: new Set()
};

app.use((req, res, next) => {
  analytics.requests++;
  
  if (req.user) {
    analytics.users.add(req.user.id);
  }
  
  next();
});

app.get('/analytics', (req, res) => {
  res.json({
    totalRequests: analytics.requests,
    totalErrors: analytics.errors,
    uniqueUsers: analytics.users.size,
    uptime: Date.now() - startTime
  });
});
```

## Best Practices

### Development Workflow

1. **Use Version Control**: Enable Git integration in Replit
2. **Environment Separation**: Use different Repls for dev/staging/prod
3. **Regular Backups**: Export code regularly
4. **Testing**: Write tests and run them in Replit console
5. **Documentation**: Keep README updated with Replit-specific instructions

### Code Organization

```
riderpro/
├── client/                 # Frontend React app
├── server/                 # Backend Node.js app
├── shared/                 # Shared types and utilities
├── docs/                   # Documentation
├── .replit                 # Replit configuration
├── replit.nix             # Nix dependencies
├── package.json           # Node.js dependencies
└── README.md              # Project documentation
```

### Performance Tips

1. **Minimize Dependencies**: Only install necessary packages
2. **Use CDN**: Serve static assets from CDN when possible
3. **Enable Compression**: Use gzip compression for responses
4. **Optimize Images**: Compress images before uploading
5. **Cache Data**: Implement caching for frequently accessed data

## Support and Resources

### Replit Documentation
- [Replit Docs](https://docs.replit.com/)
- [Node.js on Replit](https://docs.replit.com/programming-ide/languages/nodejs)
- [Deployment Guide](https://docs.replit.com/hosting/deployments/about-deployments)

### Community Resources
- [Replit Community](https://replit.com/community)
- [Discord Server](https://discord.gg/replit)
- [GitHub Discussions](https://github.com/replit/replit/discussions)

### Getting Help

1. **Check Console**: Look for error messages in Replit console
2. **Review Logs**: Check server logs for issues
3. **Test Locally**: Compare behavior with local development
4. **Community Support**: Ask questions in Replit community
5. **Documentation**: Refer to this guide and official docs

---

**Note**: This guide assumes you have a Replit account and basic familiarity with the platform. For advanced deployment scenarios, consider using dedicated hosting platforms.