// server/index.ts
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes/index.js";
import { setupVite, serveStatic } from "./vite.js";
import { initializeAuth } from "./middleware/auth.js";
import { checkDatabaseHealth } from "./db/connection.js";
import cors from 'cors';
import rateLimit from "express-rate-limit";
import { log } from "../shared/utils/logger.js";

const app = express();

// Debug request logging removed - too noisy with Vite dev server
// API requests are logged by the detailed middleware below

// Request logging - only log API requests and important routes, ignore dev server noise
app.use((req, res, next) => {
  const path = req.path;
  const isDevServerRequest = 
    path.startsWith('/@') || // Vite HMR
    path.startsWith('/@fs/') || // Vite file system
    path.startsWith('/@vite/') || // Vite client
    path.startsWith('/@react-refresh') || // React refresh
    path.startsWith('/node_modules/') || // Node modules
    path.includes('.well-known') || // Well-known files
    path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.css') || // Static assets
    path.endsWith('.png') || path.endsWith('.ico') || path.endsWith('.webmanifest') || // Images/manifests
    path.startsWith('/dev-sw') || // Service worker
    path.startsWith('/workbox-'); // Workbox files
  
  // Only log API requests and important routes (not dev server noise)
  if (!isDevServerRequest && (path.startsWith('/api') || path === '/' || path === '/health')) {
    // Use log.info for important requests only
    if (path.startsWith('/api')) {
      // API requests will be logged by the detailed middleware below
    } else {
      // Log important non-API routes
      log.dev(`${req.method} ${path}`);
    }
  }
  next();
});

// Security headers
// Disabled Helmet for now to fix blank screen issue

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." }
});
app.use("/api", limiter);

// Enable CORS for all routes (since we're making direct API calls)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['X-Total-Count', 'X-Total-Pages', 'X-Current-Page', 'X-Per-Page', 'X-Has-Next-Page', 'X-Has-Previous-Page'],
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log.info(logLine);
    }
  });

  next();
});

// Health check endpoint with caching
interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  cached: boolean;
  database?: {
    main: boolean;
    backup: boolean | null;
  };
}

let mainHealthCache: { data: HealthData; timestamp: number } | null = null;
const MAIN_HEALTH_CACHE_TTL = 10000; // 10 seconds cache

app.get("/health", async (req, res) => {
  const now = Date.now();

  // Return cached response if still valid
  if (mainHealthCache && (now - mainHealthCache.timestamp) < MAIN_HEALTH_CACHE_TTL) {
    res.set('Cache-Control', 'public, max-age=10');
    res.set('X-Health-Cache', 'HIT');
    return res.json({ ...mainHealthCache.data, cached: true });
  }

  // Check database health
  const dbHealth = await checkDatabaseHealth();

  // Generate new response and cache it
  const healthData = {
    status: dbHealth.main ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cached: false,
    database: dbHealth
  };

  mainHealthCache = {
    data: healthData,
    timestamp: now
  };

  res.set('Cache-Control', 'public, max-age=10');
  res.set('X-Health-Cache', 'MISS');
  res.json(healthData);
});

// API status endpoint for debugging
app.get("/api-status", (req, res) => {
  const popsApiUrl = process.env.POPS_API_BASE_URL || 'POPS_API_BASE_URL not configured';
  res.json({
    message: `Server is running. POPS API: ${popsApiUrl}`,
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    log.info('🚀 Starting RiderPro server...');

    // Step 1: Check database health
    log.info('Checking database connection...');
    const health = await checkDatabaseHealth();
    if (!health.main) {
      throw new Error('Main database connection failed. Please check your DATABASE_URL');
    }

    // Step 2: Initialize database tables
    // Database initialization is now handled via explicit migration scripts
    // Run 'npm run db:migrate' to initialize/update the database
    log.info('Skipping auto-initialization of database tables (handled by migrations)');

    // Backup database removed - not needed

    // Step 4: Initialize authentication
    initializeAuth();

    // Step 5: Register routes
    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Error:", err);
      res.status(status).json({ error: true, message });
    });

    // Setup Vite in development, serve static files in production
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(port, "0.0.0.0", () => {
      log.info('\n=== RiderPro Delivery Management System ===');
      log.info(`🚀 Server running on port ${port}`);
      log.info(`🌐 Application: http://localhost:${port}`);
      log.info(`📱 Mobile App: http://localhost:${port} (responsive design)`);
      log.info(`📡 API Endpoints: http://localhost:${port}/api/*`);
      log.info(`🔍 Health Check: http://localhost:${port}/health`);
      log.info(`📊 Admin Panel: http://localhost:${port}/admin`);
      log.info(`📦 Shipments: http://localhost:${port}/shipments`);
      log.info(`⚙️  Settings: http://localhost:${port}/settings`);
      log.info(`\n🔑 API Keys: Hardcoded (see admin panel for details)`);
      log.info(`🗄️  Database: PostgreSQL with connection pooling`);
      log.info(`🔄 Sync Status: Real-time external API integration`);
      log.info(`📍 GPS Tracking: Auto-calculated distance tracking`);
      log.info(`👥 Roles: Super User, Ops Team, Staff, Driver`);
      log.info('===============================================\n');
    });

    // Backup database removed - no scheduled sync needed

    return server;

  } catch (error) {
    log.error('Failed to start server', error);
    setTimeout(() => process.exit(1), 1000);
  }
}

// 🔥 IMPORTANT: call it WITHOUT awaiting
startServer();