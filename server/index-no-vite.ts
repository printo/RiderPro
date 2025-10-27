// server/index-no-vite.ts
import dotenv from 'dotenv';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { initializeAuth } from "./middleware/auth";
import cors from 'cors';

// Simple logger shim
const log = console.log;

// No Vite imports - this is for Vercel serverless
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
    status: "ok",
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL
  });
});

// Initialize auth middleware
initializeAuth(app);

// Track initialization state
let isInitializing = false;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: err.message });
});

// Initialize routes asynchronously
const initializeApp = async () => {
  if (isInitialized) return;
  if (isInitializing) return initializationPromise!;

  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log("📦 Starting server initialization...");
      await registerRoutes(app);
      isInitialized = true;
      console.log("✅ Server initialization complete");
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      throw error;
    }
  })();

  return initializationPromise;
};

// Start initialization immediately
initializeApp().catch(console.error);

export { app, initializationPromise, isInitialized, isInitializing };
