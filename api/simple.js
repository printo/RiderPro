// Simplified Express app for Vercel (CommonJS)
const express = require('express');

const app = express();

// Basic middleware
app.use(express.json());

// Simple health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API status endpoint
app.get('/api-status', (req, res) => {
  res.json({
    message: 'Simple server is running',
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
module.exports = app;
