# API Inventory - RiderPro Route Tracking System

## Overview
This document provides a comprehensive inventory of all API endpoints in the RiderPro system, including both server-side routes and client-side API usage patterns.

## System Health & Monitoring APIs

### Health Check
- **GET** `/api/health`
  - **Purpose**: System health monitoring with caching and rate limiting
  - **Rate Limit**: 10 requests per minute per IP
  - **Cache**: 10 seconds TTL
  - **Response**: System status, uptime, database connectivity
  - **Usage**: Monitoring, load balancer health checks

## Authentication & User Management APIs

### User Registration & Login
- **POST** `/api/auth/register`
  - **Purpose**: Register new local users (requires approval)
  - **Body**: `{ riderId, password, fullName, email? }`
  - **Security**: Passwords hashed with bcrypt (12 salt rounds)
  - **Response**: `{ success, message, userId }`

- **POST** `/api/auth/local-login`
  - **Purpose**: Login with local database credentials
  - **Body**: `{ riderId, password }`
  - **Security**: bcrypt password verification
  - **Response**: `{ success, accessToken, refreshToken, fullName, isApproved }`

### Admin User Management
- **GET** `/api/auth/pending-approvals`
  - **Purpose**: Get users pending approval (admin only)
  - **Response**: `{ success, users: [{ id, rider_id, full_name, email, created_at }] }`

- **POST** `/api/auth/approve/:userId`
  - **Purpose**: Approve user account (admin only)
  - **Response**: `{ success, message }`

- **POST** `/api/auth/reject/:userId`
  - **Purpose**: Reject user account (admin only)
  - **Response**: `{ success, message }`

- **POST** `/api/auth/reset-password/:userId`
  - **Purpose**: Reset user password (admin only)
  - **Body**: `{ newPassword }`
  - **Security**: bcrypt hashing
  - **Response**: `{ success, message }`

## Shipment Management APIs

### Shipment CRUD Operations
- **GET** `/api/shipments`
  - **Purpose**: Get shipments with filtering, pagination, sorting
  - **Query Params**: `page`, `limit`, `status`, `employeeId`, `sortBy`, `sortOrder`
  - **Response**: Array of shipments with pagination headers
  - **Headers**: `X-Total-Count`, `X-Total-Pages`, `X-Current-Page`, `X-Per-Page`

- **GET** `/api/shipments/:id`
  - **Purpose**: Get single shipment by ID
  - **Response**: Single shipment object

- **POST** `/api/shipments`
  - **Purpose**: Create new shipment
  - **Body**: Shipment object with validation
  - **Response**: `{ success, trackingNumber, shipment }`

- **PATCH** `/api/shipments/:id`
  - **Purpose**: Update single shipment
  - **Body**: Partial shipment object
  - **Response**: `{ success, message, shipment }`

- **PATCH** `/api/shipments/batch`
  - **Purpose**: Batch update multiple shipments
  - **Body**: `{ updates: [{ id, changes }] }`
  - **Response**: `{ success, results: [{ id, success, error? }] }`

- **DELETE** `/api/shipments/:id`
  - **Purpose**: Delete shipment (admin only)
  - **Response**: `{ success, message }`

### Shipment Acknowledgment & Tracking
- **POST** `/api/shipments/:id/acknowledgement`
  - **Purpose**: Upload acknowledgment with photo and signature
  - **Content-Type**: `multipart/form-data`
  - **Fields**: `photo`, `signature`, `acknowledgmentType`, `notes`
  - **Response**: `{ success, message, acknowledgment }`

- **POST** `/api/shipments/:id/remarks`
  - **Purpose**: Add remarks for cancelled/returned shipments
  - **Body**: `{ remarks, reason, timestamp }`
  - **Response**: `{ success, message }`

### External System Integration
- **POST** `/api/shipments/receive`
  - **Purpose**: Receive shipment data from external systems
  - **Security**: Webhook authentication, rate limiting
  - **Body**: Shipment data from external system
  - **Response**: `{ success, message, processedCount }`

- **POST** `/api/shipments/update/external`
  - **Purpose**: Send single shipment update to external system
  - **Security**: Webhook authentication
  - **Body**: `{ shipmentId, updates }`
  - **Response**: `{ success, message }`

- **POST** `/api/shipments/update/external/batch`
  - **Purpose**: Send batch shipment updates to external system
  - **Security**: Webhook authentication
  - **Body**: `{ updates: [{ shipmentId, changes }] }`
  - **Response**: `{ success, message, results }`

## Route Tracking & GPS APIs

### Route Session Management
- **POST** `/api/routes/start`
  - **Purpose**: Start a new route session
  - **Body**: `{ employeeId, startLatitude, startLongitude, shipmentId? }`
  - **Response**: `{ success, sessionId, message }`

- **POST** `/api/routes/stop`
  - **Purpose**: Stop a route session
  - **Body**: `{ sessionId, endLatitude, endLongitude }`
  - **Response**: `{ success, message, session }`

- **GET** `/api/routes/session/:sessionId`
  - **Purpose**: Get session data
  - **Response**: `{ success, session, coordinates }`

### GPS Coordinate Tracking
- **POST** `/api/routes/coordinates`
  - **Purpose**: Submit single GPS coordinate
  - **Body**: `{ sessionId, latitude, longitude, accuracy?, speed?, timestamp? }`
  - **Response**: `{ success, message, coordinateId }`

- **POST** `/api/routes/coordinates/batch`
  - **Purpose**: Submit multiple GPS coordinates
  - **Body**: `{ coordinates: [{ sessionId, latitude, longitude, ... }] }`
  - **Response**: `{ success, message, results }`

### Shipment Events & Offline Sync
- **POST** `/api/routes/shipment-event`
  - **Purpose**: Record shipment event (pickup/delivery) for a session
  - **Body**: `{ sessionId, shipmentId, eventType, latitude, longitude }`
  - **Response**: `{ success, message, eventId }`

- **POST** `/api/routes/sync-session`
  - **Purpose**: Sync route session created while offline
  - **Body**: `{ id, employeeId, startTime, endTime, status, startLatitude, startLongitude, endLatitude, endLongitude }`
  - **Response**: `{ success, message, sessionId }`

- **POST** `/api/routes/sync-coordinates`
  - **Purpose**: Sync coordinates captured while offline
  - **Body**: `{ sessionId, coordinates: [{ latitude, longitude, accuracy?, timestamp? }] }`
  - **Response**: `{ success, message, results }`

## Data Synchronization APIs

### Sync Management
- **GET** `/api/sync/stats`
  - **Purpose**: Get synchronization statistics
  - **Response**: `{ success, stats: { pending, synced, failed, lastSync } }`

- **POST** `/api/sync/trigger`
  - **Purpose**: Trigger manual synchronization
  - **Response**: `{ success, message, syncedCount }`

## Dashboard & Analytics APIs

### Dashboard Data
- **GET** `/api/dashboard`
  - **Purpose**: Get dashboard metrics and statistics
  - **Response**: Dashboard data with metrics

## Error Handling & Logging

### Error Logging
- **POST** `/api/errors`
  - **Purpose**: Log frontend errors
  - **Body**: Error object
  - **Response**: `{ logged: true }`

## File Upload & Static Assets

### File Handling
- **Static** `/uploads/*`
  - **Purpose**: Serve uploaded files (photos, signatures)
  - **CORS**: Enabled for file access

## Client-Side API Usage Patterns

### Authentication Flow
1. **External API Login**: Direct call to `https://pia.printo.in/api/v1/auth/`
   - **Method**: POST
   - **Body**: `{ employee_id, password }`
   - **Response**: `{ access, refresh, full_name, is_staff?, is_super_user?, is_ops_team?, employee_id }`

2. **Local Database Login**: Call to `/api/auth/local-login`
   - **Method**: POST
   - **Body**: `{ riderId, password }`
   - **Response**: `{ success, accessToken, refreshToken, fullName, isApproved }`

### Data Fetching
- **Shipments**: `GET /api/shipments` with query parameters
- **Routes**: `GET /api/routes/session/:sessionId`
- **Dashboard**: `GET /api/dashboard`

### Data Submission
- **GPS Coordinates**: `POST /api/routes/coordinates` or batch endpoint
- **Shipment Updates**: `PATCH /api/shipments/:id` or batch endpoint
- **Acknowledgment**: `POST /api/shipments/:id/acknowledgement` with file upload

### Offline Sync
- **Session Sync**: `POST /api/routes/sync-session`
- **Coordinate Sync**: `POST /api/routes/sync-coordinates`
- **Manual Trigger**: `POST /api/sync/trigger`

## Security & Authentication

### External API Integration
- **Base URL**: `https://pia.printo.in/api/v1/`
- **Authentication**: Direct employee_id/password login
- **Token Management**: Access/refresh tokens stored in localStorage
- **Role Determination**: Based on `is_staff`, `is_super_user`, `is_ops_team` flags

### Local Database Security
- **Password Hashing**: bcrypt with 12 salt rounds
- **Session Management**: Simple token-based (local development)
- **Approval Workflow**: Admin approval required for new users

### Webhook Security
- **Authentication**: Webhook-specific auth middleware
- **Rate Limiting**: Applied to webhook endpoints
- **Payload Validation**: Comprehensive validation for external data

## Rate Limiting & Caching

### Rate Limits
- **Health Check**: 10 requests/minute per IP
- **Webhooks**: Configurable per endpoint
- **General APIs**: No rate limiting (development mode)

### Caching
- **Health Check**: 10-second TTL
- **Dashboard**: No caching (real-time data)
- **Shipments**: No caching (real-time updates)

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes
- **200**: Success
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate data)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

## API Dependencies

### External Services
- **Printo API**: `https://pia.printo.in/api/v1/` (authentication)
- **File Storage**: Local filesystem (`/uploads/`)

### Internal Services
- **Database**: SQLite with better-sqlite3
- **File Upload**: Multer for multipart/form-data
- **Validation**: Custom validation services
- **Scheduling**: Node-cron for background tasks

---

*Last Updated: December 2024*
*Total Endpoints: 25+*
*Authentication Methods: 2 (External API + Local Database)*
*Security Level: Production-ready with bcrypt and webhook authentication*