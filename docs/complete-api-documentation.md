# Complete API Documentation

This document provides comprehensive documentation for all APIs used in the RiderPro system, including internal endpoints, external integrations, parameters, payloads, responses, and code locations.

## Table of Contents

1. [Authentication APIs](#authentication-apis)
2. [Shipment Management APIs](#shipment-management-apis)
3. [Route Tracking APIs](#route-tracking-apis)
4. [Dashboard & Analytics APIs](#dashboard--analytics-apis)
5. [Admin & Token Management APIs](#admin--token-management-apis)
6. [File Management APIs](#file-management-apis)
7. [System Health & Monitoring APIs](#system-health--monitoring-apis)
8. [External API Integrations](#external-api-integrations)
9. [Client-Side API Usage](#client-side-api-usage)
10. [Error Handling & Response Formats](#error-handling--response-formats)

---

## Authentication APIs

### POST /api/auth/login

**Purpose:** User authentication via Printo API integration

**Location:** `server/routes.ts:158`

**Called From:** 
- `client/src/services/AuthService.ts:561`
- `client/src/pages/Login.tsx`

**Parameters:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Sample Request:**
```json
{
  "email": "driver@example.com",
  "password": "password123"
}
```

**Sample Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "12345",
      "email": "driver@example.com",
      "name": "John Driver",
      "role": "driver",
      "employeeId": "EMP001"
    }
  }
}
```

**Sample Response (Error):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Authentication:** None (public endpoint)

**External Integration:** Calls `https://pia.printo.in/api/v1/auth/`

---

### POST /api/auth/refresh

**Purpose:** Refresh expired access tokens

**Location:** `server/routes.ts:237`

**Called From:** `client/src/services/AuthService.ts:254`

**Parameters:**
```json
{
  "userId": "string (optional)",
  "refresh": "string (required)"
}
```

**Sample Request:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Authentication:** None (uses refresh token)

**External Integration:** Calls `https://pia.printo.in/api/v1/auth/refresh/`

---

## Shipment Management APIs

### GET /api/shipments

**Purpose:** Get shipments with filters, pagination, and sorting

**Location:** `server/routes.ts:933`

**Called From:** `client/src/api/shipments.ts:25`

**Query Parameters:**
- `status` (string): Filter by shipment status
- `priority` (string): Filter by priority level
- `type` (string): Filter by shipment type
- `routeName` (string): Filter by route name
- `date` (string): Filter by specific date
- `search` (string): Search in shipment details
- `employeeId` (string): Filter by employee ID
- `dateRange` (JSON string): Date range filter
- `page` (number): Page number for pagination
- `limit` (number): Items per page
- `sortField` (string): Field to sort by
- `sortOrder` (string): 'asc' or 'desc'

**Sample Request:**
```
GET /api/shipments?status=pending&page=1&limit=20&sortField=createdAt&sortOrder=desc
```

**Sample Response:**
```json
{
  "data": [
    {
      "id": "ship_001",
      "trackingNumber": "TRK123456",
      "status": "pending",
      "priority": "high",
      "type": "delivery",
      "routeName": "Route A",
      "customerName": "John Doe",
      "customerPhone": "+1234567890",
      "pickupAddress": "123 Main St",
      "deliveryAddress": "456 Oak Ave",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

**Response Headers:**
- `X-Total-Count`: Total number of shipments
- `X-Total-Pages`: Total number of pages
- `X-Current-Page`: Current page number
- `X-Per-Page`: Items per page
- `X-Has-Next-Page`: Boolean indicating if next page exists
- `X-Has-Previous-Page`: Boolean indicating if previous page exists

**Authentication:** JWT Token required

---

### GET /api/shipments/:id

**Purpose:** Get single shipment details with acknowledgment

**Location:** `server/routes.ts:1089`

**Called From:** `client/src/api/shipments.ts:75`

**Parameters:**
- `id` (path parameter): Shipment ID

**Sample Request:**
```
GET /api/shipments/ship_001
```

**Sample Response:**
```json
{
  "shipment": {
    "id": "ship_001",
    "trackingNumber": "TRK123456",
    "status": "delivered",
    "priority": "high",
    "type": "delivery",
    "routeName": "Route A",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "pickupAddress": "123 Main St",
    "deliveryAddress": "456 Oak Ave",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T14:45:00Z"
  },
  "acknowledgment": {
    "id": "ack_001",
    "shipmentId": "ship_001",
    "photoPath": "/uploads/delivery_photos/photo_001.jpg",
    "signaturePath": "/uploads/signatures/sig_001.png",
    "deliveredAt": "2024-01-15T14:45:00Z",
    "notes": "Package delivered to front door"
  }
}
```

**Authentication:** JWT Token or API Token

---

### POST /api/shipments

**Purpose:** Create new shipment

**Location:** `server/routes.ts:1112`

**Called From:** `client/src/api/shipments.ts:79`

**Parameters:**
```json
{
  "trackingNumber": "string (required)",
  "customerName": "string (required)",
  "customerPhone": "string (required)",
  "pickupAddress": "string (required)",
  "deliveryAddress": "string (required)",
  "priority": "low|medium|high (optional, default: medium)",
  "type": "pickup|delivery (required)",
  "routeName": "string (optional)",
  "notes": "string (optional)",
  "scheduledDate": "string (ISO date, optional)"
}
```

**Sample Request:**
```json
{
  "trackingNumber": "TRK789012",
  "customerName": "Jane Smith",
  "customerPhone": "+1987654321",
  "pickupAddress": "789 Pine St",
  "deliveryAddress": "321 Elm Ave",
  "priority": "high",
  "type": "delivery",
  "routeName": "Route B",
  "notes": "Fragile items",
  "scheduledDate": "2024-01-16T09:00:00Z"
}
```

**Sample Response:**
```json
{
  "id": "ship_002",
  "trackingNumber": "TRK789012",
  "status": "pending",
  "priority": "high",
  "type": "delivery",
  "routeName": "Route B",
  "customerName": "Jane Smith",
  "customerPhone": "+1987654321",
  "pickupAddress": "789 Pine St",
  "deliveryAddress": "321 Elm Ave",
  "notes": "Fragile items",
  "scheduledDate": "2024-01-16T09:00:00Z",
  "createdAt": "2024-01-15T15:30:00Z",
  "updatedAt": "2024-01-15T15:30:00Z"
}
```

**Authentication:** JWT Token or API Token

---

### PATCH /api/shipments/:id

**Purpose:** Update single shipment status

**Location:** `server/routes.ts:1408`

**Called From:** `client/src/api/shipments.ts:83`

**Parameters:**
- `id` (path parameter): Shipment ID

**Request Body:**
```json
{
  "status": "pending|in_transit|delivered|cancelled|returned (optional)",
  "priority": "low|medium|high (optional)",
  "routeName": "string (optional)",
  "notes": "string (optional)",
  "scheduledDate": "string (ISO date, optional)"
}
```

**Sample Request:**
```json
{
  "status": "in_transit",
  "notes": "Package picked up and en route"
}
```

**Sample Response:**
```json
{
  "id": "ship_001",
  "trackingNumber": "TRK123456",
  "status": "in_transit",
  "priority": "high",
  "type": "delivery",
  "routeName": "Route A",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "pickupAddress": "123 Main St",
  "deliveryAddress": "456 Oak Ave",
  "notes": "Package picked up and en route",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T12:15:00Z"
}
```

**Authentication:** JWT Token or API Token

---

### PATCH /api/shipments/batch

**Purpose:** Batch update multiple shipments

**Location:** `server/routes.ts:1458`

**Called From:** `client/src/api/shipments.ts:87`

**Parameters:**
```json
{
  "shipmentIds": ["string"] (required),
  "updates": {
    "status": "string (optional)",
    "priority": "string (optional)",
    "routeName": "string (optional)",
    "notes": "string (optional)"
  }
}
```

**Sample Request:**
```json
{
  "shipmentIds": ["ship_001", "ship_002", "ship_003"],
  "updates": {
    "status": "in_transit",
    "routeName": "Route A"
  }
}
```

**Sample Response:**
```json
{
  "updatedCount": 3,
  "message": "Successfully updated 3 shipments"
}
```

**Authentication:** JWT Token or API Token

---

### POST /api/shipments/:id/acknowledgement

**Purpose:** Upload delivery acknowledgment with photo and signature

**Location:** `server/routes.ts:1516`

**Called From:** Client-side file upload components

**Parameters:**
- `id` (path parameter): Shipment ID

**Request Body (multipart/form-data):**
- `photo` (file): Delivery photo
- `signature` (file): Customer signature
- `notes` (string, optional): Delivery notes
- `deliveredAt` (string, optional): Delivery timestamp

**Sample Response:**
```json
{
  "success": true,
  "message": "Acknowledgment uploaded successfully",
  "acknowledgment": {
    "id": "ack_001",
    "shipmentId": "ship_001",
    "photoPath": "/uploads/delivery_photos/photo_001.jpg",
    "signaturePath": "/uploads/signatures/sig_001.png",
    "notes": "Package delivered to front door",
    "deliveredAt": "2024-01-15T14:45:00Z",
    "createdAt": "2024-01-15T14:45:00Z"
  }
}
```

**Authentication:** JWT Token or API Token

---

### POST /api/shipments/:id/remarks

**Purpose:** Add remarks for cancelled/returned shipments

**Location:** `server/routes.ts:1622`

**Parameters:**
- `id` (path parameter): Shipment ID

**Request Body:**
```json
{
  "remarks": "string (required)",
  "reasonCode": "string (optional)"
}
```

**Sample Request:**
```json
{
  "remarks": "Customer not available for delivery",
  "reasonCode": "CUSTOMER_UNAVAILABLE"
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Remarks added successfully",
  "shipment": {
    "id": "ship_001",
    "status": "returned",
    "remarks": "Customer not available for delivery",
    "reasonCode": "CUSTOMER_UNAVAILABLE",
    "updatedAt": "2024-01-15T16:30:00Z"
  }
}
```

**Authentication:** JWT Token or API Token

---

### DELETE /api/shipments/:id

**Purpose:** Delete shipment (admin only)

**Location:** `server/routes.ts:1667`

**Parameters:**
- `id` (path parameter): Shipment ID

**Sample Response:**
```json
{
  "success": true,
  "message": "Shipment deleted successfully"
}
```

**Authentication:** JWT Token or API Token (admin role required)

---

## Route Tracking APIs

### POST /api/routes/start

**Purpose:** Start a new route session for driver

**Location:** `server/routes.ts:1923`

**Called From:** `client/src/api/routes.ts:60`

**Parameters:**
```json
{
  "employeeId": "string (required)",
  "startLatitude": "number (required)",
  "startLongitude": "number (required)",
  "shipmentId": "string (optional)"
}
```

**Sample Request:**
```json
{
  "employeeId": "EMP001",
  "startLatitude": 40.7128,
  "startLongitude": -74.0060,
  "shipmentId": "ship_001"
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Route session started successfully",
  "session": {
    "id": "session_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T09:00:00Z",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060,
    "status": "active",
    "shipmentId": "ship_001"
  }
}
```

**Authentication:** None (public endpoint)

---

### POST /api/routes/stop

**Purpose:** Stop active route session

**Location:** `server/routes.ts:1965`

**Called From:** `client/src/api/routes.ts:75`

**Parameters:**
```json
{
  "sessionId": "string (required)",
  "endLatitude": "number (required)",
  "endLongitude": "number (required)"
}
```

**Sample Request:**
```json
{
  "sessionId": "session_001",
  "endLatitude": 40.7589,
  "endLongitude": -73.9851
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Route session stopped successfully",
  "session": {
    "id": "session_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T17:30:00Z",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060,
    "endLatitude": 40.7589,
    "endLongitude": -73.9851,
    "status": "completed",
    "totalDistance": 25.4,
    "totalTimeSeconds": 30600
  }
}
```

**Authentication:** None (public endpoint)

---

### POST /api/routes/coordinates

**Purpose:** Submit GPS coordinates during route

**Location:** `server/routes.ts:2001`

**Called From:** `client/src/api/routes.ts:90`

**Parameters:**
```json
{
  "sessionId": "string (required)",
  "latitude": "number (required)",
  "longitude": "number (required)",
  "accuracy": "number (optional)",
  "speed": "number (optional)",
  "timestamp": "string (ISO date, optional)"
}
```

**Sample Request:**
```json
{
  "sessionId": "session_001",
  "latitude": 40.7300,
  "longitude": -73.9950,
  "accuracy": 5.2,
  "speed": 45.5,
  "timestamp": "2024-01-15T10:15:00Z"
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "GPS coordinates recorded successfully",
  "record": {
    "id": "coord_001",
    "sessionId": "session_001",
    "latitude": 40.7300,
    "longitude": -73.9950,
    "accuracy": 5.2,
    "speed": 45.5,
    "timestamp": "2024-01-15T10:15:00Z",
    "createdAt": "2024-01-15T10:15:00Z"
  }
}
```

**Authentication:** None (public endpoint)

---

### GET /api/routes/session/:sessionId

**Purpose:** Get session data and coordinates

**Location:** `server/routes.ts:2039`

**Called From:** `client/src/api/routes.ts:155`

**Parameters:**
- `sessionId` (path parameter): Route session ID

**Sample Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T09:00:00Z",
    "endTime": "2024-01-15T17:30:00Z",
    "status": "completed"
  },
  "coordinates": [
    {
      "id": "coord_001",
      "sessionId": "session_001",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "timestamp": "2024-01-15T09:00:00Z"
    },
    {
      "id": "coord_002",
      "sessionId": "session_001",
      "latitude": 40.7300,
      "longitude": -73.9950,
      "timestamp": "2024-01-15T10:15:00Z"
    }
  ]
}
```

**Authentication:** None (public endpoint)

---

### POST /api/routes/coordinates/batch

**Purpose:** Batch submit GPS coordinates (offline sync)

**Location:** `server/routes.ts:2066`

**Called From:** `client/src/api/routes.ts:225`

**Parameters:**
```json
{
  "coordinates": [
    {
      "sessionId": "string (required)",
      "latitude": "number (required)",
      "longitude": "number (required)",
      "accuracy": "number (optional)",
      "speed": "number (optional)",
      "timestamp": "string (ISO date, optional)"
    }
  ]
}
```

**Sample Request:**
```json
{
  "coordinates": [
    {
      "sessionId": "session_001",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "timestamp": "2024-01-15T09:00:00Z"
    },
    {
      "sessionId": "session_001",
      "latitude": 40.7300,
      "longitude": -73.9950,
      "timestamp": "2024-01-15T10:15:00Z"
    }
  ]
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Batch coordinates processed",
  "results": [
    {
      "success": true,
      "record": {
        "id": "coord_001",
        "sessionId": "session_001",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "timestamp": "2024-01-15T09:00:00Z"
      }
    },
    {
      "success": true,
      "record": {
        "id": "coord_002",
        "sessionId": "session_001",
        "latitude": 40.7300,
        "longitude": -73.9950,
        "timestamp": "2024-01-15T10:15:00Z"
      }
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

**Authentication:** None (public endpoint)

---

## Dashboard & Analytics APIs

### GET /api/dashboard

**Purpose:** Get dashboard metrics and statistics

**Location:** `server/routes.ts:923`

**Called From:** `client/src/api/shipments.ts:91`

**Sample Response:**
```json
{
  "totalShipments": 1250,
  "pendingShipments": 45,
  "inTransitShipments": 78,
  "deliveredShipments": 1100,
  "cancelledShipments": 27,
  "todayDeliveries": 23,
  "activeRoutes": 12,
  "completedRoutes": 156,
  "averageDeliveryTime": 2.5,
  "onTimeDeliveryRate": 94.2,
  "recentActivity": [
    {
      "id": "activity_001",
      "type": "delivery",
      "message": "Package TRK123456 delivered successfully",
      "timestamp": "2024-01-15T14:45:00Z"
    }
  ]
}
```

**Authentication:** JWT Token required

---

## Admin & Token Management APIs

### POST /api/admin/tokens

**Purpose:** Create new API token

**Location:** `server/routes.ts:437`

**Parameters:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "expiresAt": "string (ISO date, optional)",
  "permissions": ["string"] (optional)
}
```

**Sample Request:**
```json
{
  "name": "External Integration Token",
  "description": "Token for warehouse management system",
  "expiresAt": "2024-12-31T23:59:59Z",
  "permissions": ["shipments:read", "shipments:write"]
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "API token created successfully",
  "token": {
    "id": "token_001",
    "name": "External Integration Token",
    "description": "Token for warehouse management system",
    "token": "apt_1234567890abcdef...",
    "expiresAt": "2024-12-31T23:59:59Z",
    "permissions": ["shipments:read", "shipments:write"],
    "status": "active",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

**Authentication:** JWT Token (admin role required)

---

### GET /api/admin/tokens

**Purpose:** List all API tokens

**Location:** `server/routes.ts:541`

**Sample Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "token_001",
      "name": "External Integration Token",
      "description": "Token for warehouse management system",
      "status": "active",
      "expiresAt": "2024-12-31T23:59:59Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "lastUsedAt": "2024-01-15T14:30:00Z",
      "usageCount": 156
    }
  ]
}
```

**Authentication:** JWT Token (admin role required)

---

### PATCH /api/admin/tokens/:id/status

**Purpose:** Enable/disable/revoke API token

**Location:** `server/routes.ts:577`

**Parameters:**
- `id` (path parameter): Token ID

**Request Body:**
```json
{
  "status": "active|disabled|revoked (required)"
}
```

**Sample Request:**
```json
{
  "status": "disabled"
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Token status updated successfully",
  "token": {
    "id": "token_001",
    "name": "External Integration Token",
    "status": "disabled",
    "updatedAt": "2024-01-15T15:00:00Z"
  }
}
```

**Authentication:** JWT Token (admin role required)

---

## File Management APIs

### GET /uploads/*

**Purpose:** Serve uploaded files (photos, signatures)

**Location:** `server/routes.ts:914`

**Sample Request:**
```
GET /uploads/delivery_photos/photo_001.jpg
```

**Response:** Binary file content with appropriate MIME type

**Authentication:** None (public access with CORS headers)

---

## System Health & Monitoring APIs

### GET /api/health

**Purpose:** System health check with rate limiting

**Location:** `server/routes.ts:103`

**Called From:** `client/src/api/routes.ts:295`

**Sample Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 86400,
  "version": "1.0.0"
}
```

**Rate Limiting:** 10 requests per minute per IP

**Authentication:** None (public endpoint)

---

### GET /health

**Purpose:** Basic health check endpoint

**Location:** `server/index.ts:57`

**Sample Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Authentication:** None (public endpoint)

---

### POST /api/errors

**Purpose:** Log client-side errors for monitoring

**Location:** `server/routes.ts:2119`

**Parameters:**
```json
{
  "message": "string (required)",
  "stack": "string (optional)",
  "url": "string (optional)",
  "userAgent": "string (optional)",
  "timestamp": "string (ISO date, optional)"
}
```

**Sample Request:**
```json
{
  "message": "TypeError: Cannot read property 'id' of undefined",
  "stack": "TypeError: Cannot read property 'id' of undefined\n    at ShipmentList.tsx:45:12",
  "url": "/shipments",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Sample Response:**
```json
{
  "success": true,
  "message": "Error logged successfully"
}
```

**Authentication:** None (public endpoint)

---

## External API Integrations

### Printo API Authentication

**Base URL:** `https://pia.printo.in/api/v1/`

#### POST /auth/

**Purpose:** Primary user authentication

**Called From:** `server/routes.ts:158` (internal login endpoint)

**Parameters:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Sample Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 12345,
      "email": "driver@example.com",
      "name": "John Driver",
      "is_admin": false,
      "is_delivery": true,
      "employee_id": "EMP001"
    }
  }
}
```

#### POST /auth/refresh/

**Purpose:** Refresh access tokens

**Called From:** `server/routes.ts:237` (internal refresh endpoint)

**Parameters:**
```json
{
  "refresh": "string (required)"
}
```

**Sample Response:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET /auth/me/

**Purpose:** Verify user token and get user info

**Called From:** `client/src/services/AuthService.ts:1317`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Sample Response:**
```json
{
  "user": {
    "id": 12345,
    "email": "driver@example.com",
    "name": "John Driver",
    "is_admin": false,
    "is_delivery": true,
    "employee_id": "EMP001"
  }
}
```

---

## Client-Side API Usage

### API Service Architecture

#### ApiClient Service
**Location:** `client/src/services/ApiClient.ts`

**Features:**
- Automatic token refresh on 401 errors
- Request retry with exponential backoff
- Offline request queueing
- Network status monitoring
- Request/response caching

**Usage Pattern:**
```typescript
import { apiClient } from '@/services/ApiClient';

// GET request
const response = await apiClient.get('/api/shipments');

// POST request with data
const response = await apiClient.post('/api/shipments', shipmentData);

// Request with custom headers
const response = await apiClient.request('/api/endpoint', {
  method: 'PATCH',
  headers: { 'Custom-Header': 'value' },
  body: JSON.stringify(data)
});
```

#### AuthService
**Location:** `client/src/services/AuthService.ts`

**Features:**
- Token management and storage
- Automatic token refresh
- Fallback authentication strategies
- Network-aware authentication

**Usage Pattern:**
```typescript
import authService from '@/services/AuthService';

// Login
const result = await authService.login(email, password);

// Check authentication status
const isAuthenticated = authService.isAuthenticated();

// Get current user
const user = authService.getCurrentUser();

// Logout
await authService.logout();
```

#### Shipments API
**Location:** `client/src/api/shipments.ts`

**Usage Pattern:**
```typescript
import { shipmentsApi } from '@/api/shipments';

// Get shipments with filters
const result = await shipmentsApi.getShipments({
  status: 'pending',
  page: 1,
  limit: 20
});

// Create shipment
const shipment = await shipmentsApi.createShipment(shipmentData);

// Update shipment
const updated = await shipmentsApi.updateShipment(id, updates);
```

#### Routes API
**Location:** `client/src/api/routes.ts`

**Usage Pattern:**
```typescript
import { routeAPI } from '@/api/routes';

// Start route session
const session = await routeAPI.startSession({
  employeeId: 'EMP001',
  startLatitude: 40.7128,
  startLongitude: -74.0060
});

// Submit GPS coordinates
const record = await routeAPI.submitCoordinates({
  sessionId: session.id,
  latitude: 40.7300,
  longitude: -73.9950
});
```

---

## Error Handling & Response Formats

### Standard Response Format

All API endpoints follow a consistent response format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}
```

### HTTP Status Codes

- `200 OK`: Successful GET, PATCH, DELETE requests
- `201 Created`: Successful POST requests
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate tracking number)
- `422 Unprocessable Entity`: Validation errors
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side errors

### Authentication Methods

1. **JWT Tokens**: For user authentication
   ```
   Authorization: Bearer <jwt_token>
   ```

2. **API Tokens**: For system integration
   ```
   Authorization: Bearer <api_token>
   ```

3. **Webhook Authentication**: For external webhooks
   ```
   Authorization: Bearer <webhook_token>
   ```

### Rate Limiting

- **Health Check**: 10 requests/minute per IP
- **API Token Creation**: Rate limited per user
- **Webhook Endpoints**: Configurable rate limits
- **General API**: No explicit rate limiting (relies on authentication)

### Caching Strategy

- **Health Check**: 10-second cache
- **Static Files**: Browser caching with appropriate headers
- **Client-side**: Request caching in ApiClient service

---

## Security Considerations

### Input Validation
- All request parameters are validated
- SQL injection prevention through parameterized queries
- XSS protection through input sanitization

### Authentication Security
- JWT tokens with expiration
- Automatic token refresh
- Secure token storage
- Rate limiting on authentication endpoints

### API Security
- CORS configuration for cross-origin requests
- Request size limits
- HTTPS enforcement in production
- API token management with permissions

### File Upload Security
- File type validation
- File size limits
- Secure file storage
- Access control for uploaded files

---

## Performance Optimizations

### Database Optimization
- Indexed queries for shipment filtering
- Pagination to limit result sets
- Batch operations for bulk updates

### Caching
- Response caching for frequently accessed data
- Client-side request caching
- Static file caching

### Network Optimization
- Request compression
- Efficient payload sizes
- Batch operations for bulk data

### Offline Support
- Request queueing for offline scenarios
- Data synchronization when online
- Cached authentication state

---

This documentation provides a complete reference for all APIs in the RiderPro system. For implementation details, refer to the specific files mentioned in the "Location" sections.