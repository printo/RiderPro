// server/index.ts
import dotenv from 'dotenv';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeAuth } from "./middleware/auth";
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS for all routes (since we're making direct API calls)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://localhost:5000', 'http://localhost:5001'],
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

      log(logLine);
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

// Initialize authentication tables
initializeAuth();

// Initialize routes
let server: any = null;

// Create a function to initialize the app
const initializeApp = async () => {
  try {
    // Register routes
    server = await registerRoutes(app);
    
    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Error:", err);
      res.status(status).json({ error: true, message });
    });

    console.log('✅ Routes initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
};

// Track initialization state
export let isInitializing = false;
export let isInitialized = false;

// Create a promise that resolves when initialization is complete
export const initializationPromise = (async () => {
  isInitializing = true;
  try {
    await initializeApp();
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Initialization failed:', error);
    return false;
  }
})();

// Initialize the app based on environment
if (process.env.VERCEL) {
  // For Vercel, start initializing
  initializationPromise
    .then(() => {
      console.log('✅ Vercel app initialized - routes ready');
    })
    .catch((error) => {
      console.error('Failed to initialize Vercel app:', error);
    });
} else {
  // For local development, use async initialization
  (async () => {
    try {
      await initializeApp();
      isInitialized = true;

      // Setup Vite for development or static files for production
      if (app.get("env") === "production") {
        serveStatic(app);
      } else if (server) {
        // Development mode - setup Vite middleware
        await setupVite(app, server);
      }

      // Start server
      if (server) {
        const port = parseInt(process.env.PORT || '5000', 10);
        server.listen(port, '0.0.0.0', () => {
          console.log('\n=== RiderPro Delivery Management System ===');
          console.log(`🚀 Server running on port ${port}`);
          console.log(`🌐 Application: http://localhost:${port}`);
          console.log(`📱 Mobile App: http://localhost:${port} (responsive design)`);
          console.log(`📡 API Endpoints: http://localhost:${port}/api/*`);
          console.log(`🔍 Health Check: http://localhost:${port}/health`);
          console.log(`📊 Admin Panel: http://localhost:${port}/admin`);
          console.log(`📦 Shipments: http://localhost:${port}/shipments`);
          console.log(`⚙️  Settings: http://localhost:${port}/settings`);
          console.log(`\n🔑 API Keys: Hardcoded (see admin panel for details)`);
          console.log(`🗄️  Database: SQLite with consolidated schema`);
          console.log(`🔄 Sync Status: Real-time external API integration`);
          console.log(`📍 GPS Tracking: Auto-calculated distance tracking`);
          console.log(`👥 Roles: Super User, Ops Team, Staff, Driver`);
          console.log('===============================================\n');
        });
      }
    } catch (error) {
      console.error('Failed to start app:', error);
      process.exit(1);
    }
  })();
}

// Export the Express app for Vercel
export default app;