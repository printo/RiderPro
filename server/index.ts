// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes/index.js";
import { setupVite, serveStatic } from "./vite.js";
import { initializeAuth } from "./middleware/auth.js";
import cors from 'cors';
import { log } from "../shared/utils/logger.js";

const app = express();

// Enable CORS for all routes (since we're making direct API calls)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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
let mainHealthCache: { data: any; timestamp: number } | null = null;
const MAIN_HEALTH_CACHE_TTL = 10000; // 10 seconds cache

app.get("/health", (req, res) => {
  const now = Date.now();

  // Return cached response if still valid
  if (mainHealthCache && (now - mainHealthCache.timestamp) < MAIN_HEALTH_CACHE_TTL) {
    res.set('Cache-Control', 'public, max-age=10');
    res.set('X-Health-Cache', 'HIT');
    return res.json({ ...mainHealthCache.data, cached: true });
  }

  // Generate new response and cache it
  const healthData = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cached: false
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
  res.json({
    message: "Server is running. Direct API calls to https://pia.printo.in/api/v1/",
    timestamp: new Date().toISOString()
  });
});

(async () => {
  // Initialize authentication tables
  initializeAuth();

  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
  server.listen(port, '0.0.0.0', () => {
    log.dev('\n=== RiderPro Delivery Management System ===');
    log.dev(`🚀 Server running on port ${port}`);
    log.dev(`🌐 Application: http://localhost:${port}`);
    log.dev(`📱 Mobile App: http://localhost:${port} (responsive design)`);
    log.dev(`📡 API Endpoints: http://localhost:${port}/api/*`);
    log.dev(`🔍 Health Check: http://localhost:${port}/health`);
    log.dev(`📊 Admin Panel: http://localhost:${port}/admin`);
    log.dev(`📦 Shipments: http://localhost:${port}/shipments`);
    log.dev(`⚙️  Settings: http://localhost:${port}/settings`);
    log.dev(`\n🔑 API Keys: Hardcoded (see admin panel for details)`);
    log.dev(`🗄️  Database: SQLite with consolidated schema`);
    log.dev(`🔄 Sync Status: Real-time external API integration`);
    log.dev(`📍 GPS Tracking: Auto-calculated distance tracking`);
    log.dev(`👥 Roles: Super User, Ops Team, Staff, Driver`);
    log.dev('===============================================\n');
  });
})();