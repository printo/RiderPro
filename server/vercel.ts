// server/vercel.ts - Vercel-compatible server entry point
import dotenv from 'dotenv';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./vite";
import { initializeAuth } from "./middleware/auth";
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS for all routes (since we're making direct API calls)
app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
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

      console.log(logLine);
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

// Initialize the app asynchronously
let appInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function initializeApp() {
  if (appInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      // Initialize authentication tables
      initializeAuth();

      // Register routes
      await registerRoutes(app);

      // Error handling middleware
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        console.error("Error:", err);
        res.status(status).json({ error: true, message });
      });

      // Setup static file serving for production
      serveStatic(app);

      appInitialized = true;
      console.log('✅ Vercel app initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Vercel app:', error);
      throw error;
    }
  })();

  return initializationPromise;
}

// Middleware to ensure app is initialized before handling requests
app.use(async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (error) {
    console.error('App initialization error:', error);
    res.status(500).json({ error: true, message: 'Server initialization failed' });
  }
});

// Export the Express app for Vercel
export default app;
