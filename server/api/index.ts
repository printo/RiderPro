// API route definitions for RiderPro
// This file organizes all the API endpoints

export { registerRoutes } from '../routes.js';

// Incoming API endpoints:
// POST /api/shipments - Receive new shipment payloads
// GET /api/shipments - List shipments with filters
// PATCH /api/shipments/:id - Update single shipment
// PATCH /api/shipments/batch - Batch update shipments
// POST /api/shipments/:id/acknowledgement - Upload signatures/photos

// Outgoing sync endpoints:
// External API sync handled by services/externalSync.ts
// Retry logic with exponential backoff implemented

// Dashboard endpoints:
// GET /api/dashboard - Real-time metrics