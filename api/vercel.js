// Vercel function wrapper for Express app
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes.js';
import { initializeAuth } from '../server/middleware/auth.js';

// Create Express app
const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://localhost:5000', 'http://localhost:5001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize auth middleware
initializeAuth(app);

// Register all routes
registerRoutes(app);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: true, message: 'Internal Server Error' });
});

// Export the app for Vercel
export default app;