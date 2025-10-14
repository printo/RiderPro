# API Documentation

## Overview

RiderPro provides a comprehensive REST API for managing shipments, routes, GPS tracking, and real-time location data. The API integrates with external Printo authentication service and supports offline-first GPS tracking with automatic synchronization.

## Base URL

```
Development: http://localhost:5000/api
Production: [Your production URL]/api
External Auth: https://pia.printo.in/api/v1
```

## Authentication

The system uses JWT-based authentication with external Printo API integration for user verification and role management.

### Headers

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Client-Side Integration
```typescript
// React component usage
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/ApiClient';

const { user, isAuthenticated, login, logout } = useAuth();

// API calls with automatic authentication
const response = await apiClient.get('/api/shipments');
```

## Core Endpoints

### Authentication

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "employee_id_or_email",
  "password": "user_password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "EMP001",
      "email": "employee@company.com",
      "name": "John Doe",
      "role": "driver|ops_team|admin|super_admin",
      "employeeId": "EMP001"
    }
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

#### Token Refresh
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "EMP001"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Get Current User
```http
GET /api/auth/me
```

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "EMP001",
      "email": "employee@company.com",
      "name": "John Doe",
      "role": "ops_team",
      "employeeId": "EMP001"
    }
  }
}
```

### Shipments

#### Get Shipments (Paginated)
```http
GET /api/shipments
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status
- `type` (string): Filter by type (delivery|pickup)
- `employeeId` (string): Filter by employee (admin only)
- `routeName` (string): Filter by route name
- `date` (string): Filter by date (YYYY-MM-DD)
- `sortField` (string): Field to sort by
- `sortOrder` (string): ASC or DESC

**Response:**
```json
{
  "data": [
    {
      "id": "SHIP001",
      "trackingNumber": "TRK123456789",
      "status": "pending",
      "priority": "high",
      "type": "delivery",
      "pickupAddress": "123 Warehouse St, City",
      "deliveryAddress": "456 Customer Ave, City",
      "recipientName": "John Doe",
      "recipientPhone": "+1234567890",
      "weight": 2.5,
      "dimensions": "30x20x15 cm",
      "specialInstructions": "Handle with care",
      "estimatedDeliveryTime": "2024-01-15T14:30:00Z",
      "actualDeliveryTime": null,
      "latitude": 40.7128,
      "longitude": -74.0060,
      "routeName": "Route A",
      "employeeId": "EMP001",
      "cost": 25.50,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
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

#### Get Single Shipment
```http
GET /api/shipments/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shipment": {
      "id": "SHIP001",
      "trackingNumber": "TRK123456789",
      "status": "delivered",
      "priority": "high",
      "type": "delivery",
      "pickupAddress": "123 Warehouse St, City",
      "deliveryAddress": "456 Customer Ave, City",
      "recipientName": "John Doe",
      "recipientPhone": "+1234567890",
      "weight": 2.5,
      "dimensions": "30x20x15 cm",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "actualDeliveryTime": "2024-01-15T15:45:00Z",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T15:45:00Z"
    },
    "acknowledgment": {
      "id": "ACK001",
      "shipmentId": "SHIP001",
      "recipientName": "John Doe",
      "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
      "timestamp": "2024-01-15T15:45:00Z",
      "location": "40.7128,-74.0060",
      "notes": "Package delivered to recipient"
    }
  }
}
```

#### Create Shipment
```http
POST /api/shipments
```

**Request Body:**
```json
{
  "trackingNumber": "TRK123456789",
  "status": "pending",
  "priority": "high",
  "type": "delivery",
  "pickupAddress": "123 Warehouse St, City",
  "deliveryAddress": "456 Customer Ave, City",
  "recipientName": "John Doe",
  "recipientPhone": "+1234567890",
  "weight": 2.5,
  "dimensions": "30x20x15 cm",
  "specialInstructions": "Handle with care",
  "estimatedDeliveryTime": "2024-01-15T14:30:00Z",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "routeName": "Route A",
  "employeeId": "EMP001",
  "cost": 25.50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "SHIP001",
    "trackingNumber": "TRK123456789",
    "status": "pending",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Update Shipment
```http
PATCH /api/shipments/:id
```

**Request Body:**
```json
{
  "status": "in_transit",
  "actualDeliveryTime": "2024-01-15T15:45:00Z",
  "latitude": 40.7130,
  "longitude": -74.0062,
  "specialInstructions": "Updated delivery instructions"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "SHIP001",
    "status": "in_transit",
    "updatedAt": "2024-01-15T15:45:00Z"
  }
}
```

#### Batch Update Shipments
```http
PATCH /api/shipments/batch
```

**Request Body:**
```json
{
  "updates": [
    {
      "id": "SHIP001",
      "status": "in_transit",
      "employeeId": "EMP001"
    },
    {
      "id": "SHIP002",
      "status": "delivered",
      "actualDeliveryTime": "2024-01-15T16:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updatedCount": 2,
    "message": "Successfully updated 2 shipments"
  }
}
```

### Route Sessions (GPS Tracking)

#### Start Route Session
```http
POST /api/routes/start
```

**Request Body:**
```json
{
  "employeeId": "EMP001",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "routeId": "ROUTE_A_001",
  "driverId": "EMP001",
  "vehicleId": "VEH001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Route session started successfully",
  "session": {
    "id": "SESSION_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T08:00:00Z",
    "status": "active",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060,
    "totalDistance": 0,
    "totalTime": 0,
    "createdAt": "2024-01-15T08:00:00Z",
    "updatedAt": "2024-01-15T08:00:00Z"
  }
}
```

#### Get Active Session
```http
GET /api/routes/active/:employeeId
```

**Response (Active Session Found):**
```json
{
  "success": true,
  "session": {
    "id": "SESSION_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T08:00:00Z",
    "status": "active",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060,
    "totalDistance": 15.2,
    "totalTime": 3600,
    "createdAt": "2024-01-15T08:00:00Z",
    "updatedAt": "2024-01-15T09:00:00Z"
  }
}
```

**Response (No Active Session):**
```json
{
  "success": false,
  "message": "No active session found"
}
```

#### Record GPS Coordinates
```http
POST /api/routes/coordinates
```

**Request Body (Single Coordinate):**
```json
{
  "sessionId": "SESSION_001",
  "latitude": 40.7130,
  "longitude": -74.0062,
  "timestamp": "2024-01-15T08:15:00Z",
  "accuracy": 5.0,
  "speed": 25.5,
  "heading": 180.0
}
```

**Response:**
```json
{
  "success": true,
  "message": "GPS coordinate recorded successfully",
  "record": {
    "id": "GPS_001",
    "sessionId": "SESSION_001",
    "employeeId": "EMP001",
    "latitude": 40.7130,
    "longitude": -74.0062,
    "timestamp": "2024-01-15T08:15:00Z",
    "accuracy": 5.0,
    "speed": 25.5,
    "eventType": "gps",
    "date": "2024-01-15"
  }
}
```

#### Batch Submit GPS Coordinates
```http
POST /api/routes/coordinates/batch
```

**Request Body:**
```json
{
  "coordinates": [
    {
      "sessionId": "SESSION_001",
      "latitude": 40.7130,
      "longitude": -74.0062,
      "timestamp": "2024-01-15T08:15:00Z",
      "accuracy": 5.0,
      "speed": 25.5
    },
    {
      "sessionId": "SESSION_001",
      "latitude": 40.7135,
      "longitude": -74.0065,
      "timestamp": "2024-01-15T08:16:00Z",
      "accuracy": 4.8,
      "speed": 28.2
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch GPS coordinates processed",
  "results": [
    {
      "success": true,
      "record": {
        "id": "GPS_001",
        "sessionId": "SESSION_001",
        "latitude": 40.7130,
        "longitude": -74.0062,
        "timestamp": "2024-01-15T08:15:00Z"
      }
    },
    {
      "success": true,
      "record": {
        "id": "GPS_002",
        "sessionId": "SESSION_001",
        "latitude": 40.7135,
        "longitude": -74.0065,
        "timestamp": "2024-01-15T08:16:00Z"
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

#### Record Shipment Event
```http
POST /api/routes/shipment-event
```

**Request Body:**
```json
{
  "sessionId": "SESSION_001",
  "shipmentId": "SHIP001",
  "eventType": "pickup",
  "latitude": 40.7140,
  "longitude": -74.0070
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipment event recorded successfully",
  "record": {
    "id": "EVENT_001",
    "sessionId": "SESSION_001",
    "employeeId": "EMP001",
    "latitude": 40.7140,
    "longitude": -74.0070,
    "timestamp": "2024-01-15T08:30:00Z",
    "eventType": "pickup",
    "shipmentId": "SHIP001",
    "date": "2024-01-15"
  }
}
```

#### Stop Route Session
```http
POST /api/routes/stop
```

**Request Body:**
```json
{
  "sessionId": "SESSION_001",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Response:**
```json
{
  "success": true,
  "message": "Route session stopped successfully",
  "session": {
    "id": "SESSION_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T08:00:00Z",
    "endTime": "2024-01-15T16:00:00Z",
    "status": "completed",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060,
    "endLatitude": 40.7128,
    "endLongitude": -74.0060,
    "totalDistance": 125.5,
    "totalTime": 28800,
    "createdAt": "2024-01-15T08:00:00Z",
    "updatedAt": "2024-01-15T16:00:00Z"
  }
}
```

#### Get Session Coordinates
```http
GET /api/routes/session/:sessionId
```

**Response:**
```json
{
  "success": true,
  "coordinates": [
    {
      "id": "GPS_001",
      "sessionId": "SESSION_001",
      "employeeId": "EMP001",
      "latitude": 40.7130,
      "longitude": -74.0062,
      "timestamp": "2024-01-15T08:15:00Z",
      "accuracy": 5.0,
      "speed": 25.5,
      "eventType": "gps",
      "date": "2024-01-15"
    }
  ],
  "count": 1
}
```

#### Get Session Summary
```http
GET /api/routes/session/:sessionId/summary
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "sessionId": "SESSION_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T08:00:00Z",
    "endTime": "2024-01-15T16:00:00Z",
    "totalDistance": 125.5,
    "totalTimeSeconds": 28800,
    "averageSpeed": 15.7,
    "coordinateCount": 960,
    "status": "completed"
  }
}
```

### Analytics

#### Get Route Analytics
```http
GET /api/routes/analytics
```

**Query Parameters:**
- `startDate` (string): Start date (YYYY-MM-DD)
- `endDate` (string): End date (YYYY-MM-DD)
- `employeeId` (string): Filter by employee
- `date` (string): Specific date (YYYY-MM-DD)
- `sessionStatus` (string): Filter by session status

**Response:**
```json
{
  "success": true,
  "analytics": [
    {
      "routeId": "ROUTE_001",
      "employeeId": "EMP001",
      "totalDistance": 125.5,
      "totalTime": 28800,
      "averageSpeed": 15.7,
      "fuelConsumption": 12.5,
      "fuelConsumed": 12.5,
      "fuelCost": 18.75,
      "stops": 8,
      "efficiency": 85.2,
      "shipmentsCompleted": 12,
      "date": "2024-01-15"
    },
    {
      "routeId": "ROUTE_002",
      "employeeId": "EMP002",
      "totalDistance": 98.3,
      "totalTime": 25200,
      "averageSpeed": 14.1,
      "fuelConsumption": 9.8,
      "fuelConsumed": 9.8,
      "fuelCost": 14.70,
      "stops": 6,
      "efficiency": 78.9,
      "shipmentsCompleted": 9,
      "date": "2024-01-15"
    }
  ],
  "count": 2
}
```

#### Get Performance Metrics
```http
GET /api/analytics/performance
```

**Query Parameters:**
- `dateRange[start]` (string): Start date
- `dateRange[end]` (string): End date
- `employeeId` (string): Filter by employee

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-15",
      "averageSpeed": 15.7,
      "efficiency": 85.2,
      "deliveryTime": 1800,
      "customerSatisfaction": 4.8
    }
  ]
}
```

#### Get Fuel Analytics
```http
GET /api/analytics/fuel
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-15",
      "consumption": 22.3,
      "cost": 33.45,
      "efficiency": 10.1,
      "distance": 223.8
    }
  ]
}
```

### Dashboard

#### Get Dashboard Metrics
```http
GET /api/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalShipments": 150,
    "completed": 85,
    "inProgress": 32,
    "pending": 28,
    "pendingShipments": 28,
    "deliveredShipments": 75,
    "inTransitShipments": 32,
    "averageDeliveryTime": 1800,
    "onTimeDeliveryRate": 92.5,
    "statusBreakdown": {
      "pending": 28,
      "assigned": 15,
      "in_transit": 32,
      "delivered": 65,
      "picked_up": 20,
      "cancelled": 8,
      "returned": 2
    },
    "typeBreakdown": {
      "delivery": 120,
      "pickup": 30
    },
    "routeBreakdown": {
      "Route A": {
        "total": 45,
        "completed": 38,
        "pending": 7
      },
      "Route B": {
        "total": 35,
        "completed": 28,
        "pending": 7
      },
      "Route C": {
        "total": 70,
        "completed": 55,
        "pending": 15
      }
    }
  }
}
```

### Acknowledgments & File Uploads

#### Create Acknowledgment with Files
```http
POST /api/acknowledgments
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
shipmentId: SHIP001
recipientName: John Doe
timestamp: 2024-01-15T15:45:00Z
location: 40.7128,-74.0060
notes: Package delivered successfully
signature: [File: signature.png]
photo: [File: delivery_photo.jpg]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ACK001",
    "shipmentId": "SHIP001",
    "recipientName": "John Doe",
    "signature": "https://storage.example.com/signatures/ACK001_signature.png",
    "photo": "https://storage.example.com/photos/ACK001_photo.jpg",
    "timestamp": "2024-01-15T15:45:00Z",
    "location": "40.7128,-74.0060",
    "notes": "Package delivered successfully",
    "createdAt": "2024-01-15T15:45:00Z"
  }
}
```

#### Get Acknowledgments for Shipment
```http
GET /api/acknowledgments/:shipmentId
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ACK001",
      "shipmentId": "SHIP001",
      "recipientName": "John Doe",
      "signature": "https://storage.example.com/signatures/ACK001_signature.png",
      "photo": "https://storage.example.com/photos/ACK001_photo.jpg",
      "timestamp": "2024-01-15T15:45:00Z",
      "location": "40.7128,-74.0060",
      "notes": "Package delivered successfully"
    }
  ]
}
```

### Sync Status

#### Get Sync Status
```http
GET /api/sync/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isOnline": true,
    "lastSync": "2024-01-15T15:45:00Z",
    "pendingUploads": 5,
    "failedUploads": 2,
    "syncInProgress": false,
    "queueStatus": {
      "gpsPoints": {
        "pending": 150,
        "failed": 5,
        "lastSync": "2024-01-15T15:40:00Z"
      },
      "shipmentEvents": {
        "pending": 3,
        "failed": 1,
        "lastSync": "2024-01-15T15:42:00Z"
      },
      "acknowledgments": {
        "pending": 2,
        "failed": 1,
        "lastSync": "2024-01-15T15:43:00Z"
      }
    },
    "recentFailures": [
      {
        "type": "gps_point",
        "id": "GPS_001",
        "error": "Network timeout",
        "attempts": 3,
        "lastAttempt": "2024-01-15T15:30:00Z",
        "nextRetry": "2024-01-15T15:50:00Z"
      }
    ]
  }
}
```

#### Trigger Manual Sync
```http
POST /api/sync/trigger
```

**Request Body:**
```json
{
  "syncTypes": ["gps_points", "shipment_events", "acknowledgments"],
  "force": false,
  "maxRetries": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "syncId": "SYNC_001",
    "status": "started",
    "queuedItems": 155,
    "estimatedDuration": 30,
    "startedAt": "2024-01-15T15:45:00Z"
  }
}
```

#### Get Sync Progress
```http
GET /api/sync/progress/:syncId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "syncId": "SYNC_001",
    "status": "in_progress",
    "progress": {
      "total": 155,
      "completed": 120,
      "failed": 5,
      "remaining": 30,
      "percentage": 77.4
    },
    "currentOperation": "Syncing GPS points",
    "estimatedTimeRemaining": 8,
    "startedAt": "2024-01-15T15:45:00Z",
    "lastUpdate": "2024-01-15T15:47:00Z"
  }
}
```

### External API Integration

#### Printo Authentication Service
```http
POST https://pia.printo.in/api/v1/auth/
```

**Request Body:**
```json
{
  "email": "employee@company.com",
  "password": "user_password"
}
```

**Response (Success):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "full_name": "John Doe",
  "is_ops_team": true,
  "user": {
    "id": "EMP001",
    "email": "employee@company.com",
    "employee_id": "EMP001",
    "is_admin": false,
    "is_super_admin": false,
    "role": "ops_team"
  }
}
```

**Response (Error):**
```json
{
  "detail": "Invalid credentials",
  "code": "authentication_failed"
}
```

#### Token Refresh
```http
POST https://pia.printo.in/api/v1/auth/refresh/
```

**Request Body:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Error):**
```json
{
  "detail": "Token is invalid or expired",
  "code": "token_not_valid"
}
```

#### User Profile Verification
```http
GET https://pia.printo.in/api/v1/auth/me/
```

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "id": "EMP001",
  "email": "employee@company.com",
  "full_name": "John Doe",
  "employee_id": "EMP001",
  "is_ops_team": true,
  "is_admin": false,
  "is_super_admin": false,
  "role": "ops_team",
  "is_active": true,
  "last_login": "2024-01-15T08:00:00Z"
}
```

## GPS Data Synchronization

### Offline Storage
- GPS points stored locally in IndexedDB
- Automatic sync when connection restored
- Conflict resolution for duplicate data
- Battery optimization for mobile devices

### Real-time Updates
- Automatic retry with exponential backoff
- Background sync for better performance
- Smart route completion detection

### Data Flow
1. **GPS Collection**: Points collected every 30 seconds during active session
2. **Local Storage**: Points stored in IndexedDB immediately
3. **Background Sync**: Automatic upload when online
4. **Conflict Resolution**: Server handles duplicate points gracefully

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {},
    "timestamp": "ISO-8601-datetime"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Invalid or expired token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request data
- `GPS_ERROR` (400): Invalid GPS coordinates
- `SESSION_ERROR` (409): Route session conflict
- `SYNC_ERROR` (500): Data synchronization failed
- `EXTERNAL_API_ERROR` (502): Printo API unavailable
- `INTERNAL_ERROR` (500): Server error

## Rate Limiting

- **Authentication**: 5 requests per minute per IP
- **Data Endpoints**: 100 requests per minute per user
- **GPS Points**: 1000 points per hour per session
- **File Uploads**: 10 requests per minute per user

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

## Pagination

All list endpoints support pagination:

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

## Data Integration Formats

### Sending Data to External Systems

#### Shipment Status Updates (Webhook Format)
When sending shipment updates to external systems, use this format:

**Single Shipment Update:**
```json
{
  "event": "shipment_status_updated",
  "timestamp": "2024-01-15T15:45:00Z",
  "source": "riderpro",
  "data": {
    "shipment": {
      "id": "SHIP001",
      "trackingNumber": "TRK123456789",
      "status": "delivered",
      "previousStatus": "in_transit",
      "updatedBy": "EMP001",
      "updatedAt": "2024-01-15T15:45:00Z",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "accuracy": 5.0,
        "address": "456 Customer Ave, City"
      },
      "deliveryDetails": {
        "actualDeliveryTime": "2024-01-15T15:45:00Z",
        "recipientName": "John Doe",
        "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
        "notes": "Package delivered successfully"
      }
    }
  }
}
```

**Batch Shipment Updates:**
```json
{
  "event": "batch_shipment_updates",
  "timestamp": "2024-01-15T16:00:00Z",
  "source": "riderpro",
  "batchId": "BATCH_001",
  "data": {
    "shipments": [
      {
        "id": "SHIP001",
        "trackingNumber": "TRK123456789",
        "status": "delivered",
        "previousStatus": "in_transit",
        "updatedBy": "EMP001",
        "updatedAt": "2024-01-15T15:45:00Z",
        "location": {
          "latitude": 40.7128,
          "longitude": -74.0060,
          "accuracy": 5.0
        }
      },
      {
        "id": "SHIP002",
        "trackingNumber": "TRK123456790",
        "status": "picked_up",
        "previousStatus": "assigned",
        "updatedBy": "EMP001",
        "updatedAt": "2024-01-15T15:50:00Z",
        "location": {
          "latitude": 40.7130,
          "longitude": -74.0062,
          "accuracy": 4.8
        }
      }
    ],
    "summary": {
      "totalUpdated": 2,
      "employeeId": "EMP001",
      "routeSession": "SESSION_001"
    }
  }
}
```

#### GPS Tracking Data Export
For sending GPS tracking data to external analytics systems:

**Route Session Summary:**
```json
{
  "event": "route_session_completed",
  "timestamp": "2024-01-15T16:00:00Z",
  "source": "riderpro",
  "data": {
    "session": {
      "id": "SESSION_001",
      "employeeId": "EMP001",
      "employeeName": "John Smith",
      "startTime": "2024-01-15T08:00:00Z",
      "endTime": "2024-01-15T16:00:00Z",
      "duration": 28800,
      "route": {
        "startLocation": {
          "latitude": 40.7128,
          "longitude": -74.0060,
          "address": "Warehouse District"
        },
        "endLocation": {
          "latitude": 40.7128,
          "longitude": -74.0060,
          "address": "Warehouse District"
        },
        "totalDistance": 125.5,
        "averageSpeed": 15.7,
        "maxSpeed": 45.2,
        "coordinateCount": 960
      },
      "performance": {
        "shipmentsCompleted": 12,
        "deliveries": 8,
        "pickups": 4,
        "fuelConsumed": 12.5,
        "fuelCost": 18.75,
        "efficiency": 85.2,
        "onTimeDeliveries": 11,
        "onTimeRate": 91.7
      },
      "gpsPoints": [
        {
          "latitude": 40.7130,
          "longitude": -74.0062,
          "timestamp": "2024-01-15T08:15:00Z",
          "accuracy": 5.0,
          "speed": 25.5,
          "heading": 180.0,
          "eventType": "gps"
        },
        {
          "latitude": 40.7140,
          "longitude": -74.0070,
          "timestamp": "2024-01-15T08:30:00Z",
          "accuracy": 4.8,
          "speed": 0.0,
          "heading": null,
          "eventType": "pickup",
          "shipmentId": "SHIP001"
        }
      ]
    }
  }
}
```

### Receiving Data from External Systems

#### Shipment Import Format
When receiving shipment data from external systems:

**Single Shipment:**
```json
{
  "trackingNumber": "TRK123456789",
  "status": "pending",
  "priority": "high",
  "type": "delivery",
  "customer": {
    "name": "John Doe",
    "phone": "+1234567890",
    "email": "john.doe@email.com"
  },
  "addresses": {
    "pickup": {
      "street": "123 Warehouse St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "coordinates": {
        "latitude": 40.7589,
        "longitude": -73.9851
      }
    },
    "delivery": {
      "street": "456 Customer Ave",
      "city": "New York", 
      "state": "NY",
      "zipCode": "10002",
      "country": "USA",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      }
    }
  },
  "package": {
    "weight": 2.5,
    "dimensions": {
      "length": 30,
      "width": 20,
      "height": 15,
      "unit": "cm"
    },
    "value": 150.00,
    "currency": "USD",
    "description": "Electronics package"
  },
  "scheduling": {
    "estimatedPickupTime": "2024-01-15T10:00:00Z",
    "estimatedDeliveryTime": "2024-01-15T14:30:00Z",
    "deliveryWindow": {
      "start": "2024-01-15T13:00:00Z",
      "end": "2024-01-15T17:00:00Z"
    }
  },
  "assignment": {
    "routeName": "Route A",
    "employeeId": "EMP001",
    "vehicleId": "VEH001",
    "priority": 1
  },
  "specialInstructions": "Handle with care - fragile electronics",
  "metadata": {
    "externalId": "EXT_12345",
    "source": "external_system",
    "createdBy": "api_integration",
    "tags": ["electronics", "fragile", "high_value"]
  }
}
```

**Batch Shipment Import:**
```json
{
  "batchId": "BATCH_IMPORT_001",
  "source": "external_system",
  "timestamp": "2024-01-15T09:00:00Z",
  "shipments": [
    {
      "trackingNumber": "TRK123456789",
      "status": "pending",
      "type": "delivery",
      "customer": {
        "name": "John Doe",
        "phone": "+1234567890"
      },
      "addresses": {
        "pickup": {
          "street": "123 Warehouse St",
          "coordinates": {
            "latitude": 40.7589,
            "longitude": -73.9851
          }
        },
        "delivery": {
          "street": "456 Customer Ave",
          "coordinates": {
            "latitude": 40.7128,
            "longitude": -74.0060
          }
        }
      },
      "package": {
        "weight": 2.5,
        "dimensions": "30x20x15 cm"
      },
      "scheduling": {
        "estimatedDeliveryTime": "2024-01-15T14:30:00Z"
      }
    }
  ],
  "validation": {
    "validateAddresses": true,
    "validateCoordinates": true,
    "allowDuplicates": false
  }
}
```

## WebSocket Events (Future)

### Connection
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');
```

### Real-time GPS Updates
```json
{
  "type": "gps_update",
  "sessionId": "SESSION_001",
  "employeeId": "EMP001",
  "latitude": 40.7130,
  "longitude": -74.0062,
  "timestamp": "2024-01-15T08:15:00Z",
  "accuracy": 5.0,
  "speed": 25.5,
  "heading": 180.0
}
```

### Shipment Status Events
```json
{
  "type": "shipment_status_update",
  "shipmentId": "SHIP001",
  "status": "delivered",
  "previousStatus": "in_transit",
  "updatedBy": "EMP001",
  "timestamp": "2024-01-15T15:45:00Z",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 5.0
  }
}
```

### Route Session Events
```json
{
  "type": "route_session_update",
  "sessionId": "SESSION_001",
  "employeeId": "EMP001",
  "event": "session_started|session_paused|session_resumed|session_completed",
  "timestamp": "2024-01-15T08:00:00Z",
  "data": {
    "totalDistance": 125.5,
    "totalTime": 28800,
    "shipmentsCompleted": 12,
    "currentLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }
}
```

## Data Validation Rules

### GPS Coordinates Validation
```json
{
  "latitude": {
    "type": "number",
    "minimum": -90,
    "maximum": 90,
    "required": true
  },
  "longitude": {
    "type": "number", 
    "minimum": -180,
    "maximum": 180,
    "required": true
  },
  "accuracy": {
    "type": "number",
    "minimum": 0,
    "maximum": 1000,
    "optional": true
  },
  "speed": {
    "type": "number",
    "minimum": 0,
    "maximum": 200,
    "optional": true
  }
}
```

### Shipment Data Validation
```json
{
  "trackingNumber": {
    "type": "string",
    "minLength": 5,
    "maxLength": 50,
    "pattern": "^[A-Z0-9]+$",
    "required": true
  },
  "weight": {
    "type": "number",
    "minimum": 0.1,
    "maximum": 1000,
    "required": true
  },
  "recipientPhone": {
    "type": "string",
    "pattern": "^\\+?[1-9]\\d{1,14}$",
    "required": true
  },
  "status": {
    "type": "string",
    "enum": ["pending", "assigned", "in_transit", "delivered", "picked_up", "cancelled", "returned"],
    "required": true
  }
}
```

### Validation Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "latitude",
      "value": 95.0,
      "constraint": "must be between -90 and 90",
      "received": "number",
      "expected": "number in range [-90, 90]"
    },
    "validationErrors": [
      {
        "field": "latitude",
        "message": "Latitude must be between -90 and 90",
        "value": 95.0
      },
      {
        "field": "recipientPhone",
        "message": "Phone number format is invalid",
        "value": "invalid-phone"
      }
    ]
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

## Complete Error Response Examples

### Authentication Errors
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired access token",
    "details": {
      "tokenExpiry": "2024-01-15T14:00:00Z",
      "currentTime": "2024-01-15T15:45:00Z"
    }
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### Permission Errors
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to access this resource",
    "details": {
      "requiredRole": "ops_team",
      "userRole": "driver",
      "resource": "/api/analytics/performance"
    }
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### Resource Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Shipment not found",
    "details": {
      "resource": "shipment",
      "id": "SHIP999",
      "searchedIn": "active_shipments"
    }
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### GPS/Location Errors
```json
{
  "success": false,
  "error": {
    "code": "GPS_ERROR",
    "message": "Invalid GPS coordinates provided",
    "details": {
      "latitude": 95.0,
      "longitude": -200.0,
      "errors": [
        "Latitude must be between -90 and 90",
        "Longitude must be between -180 and 180"
      ]
    }
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### Route Session Errors
```json
{
  "success": false,
  "error": {
    "code": "SESSION_ERROR",
    "message": "Cannot start route session: active session already exists",
    "details": {
      "employeeId": "EMP001",
      "activeSessionId": "SESSION_001",
      "activeSessionStartTime": "2024-01-15T08:00:00Z"
    }
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### Sync Errors
```json
{
  "success": false,
  "error": {
    "code": "SYNC_ERROR",
    "message": "Failed to sync GPS data to server",
    "details": {
      "batchSize": 50,
      "successful": 35,
      "failed": 15,
      "failureReasons": [
        "Network timeout",
        "Invalid session ID",
        "Duplicate coordinates"
      ]
    }
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### External API Errors
```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_API_ERROR",
    "message": "Printo authentication service unavailable",
    "details": {
      "service": "printo_auth",
      "endpoint": "https://pia.printo.in/api/v1/auth/",
      "httpStatus": 503,
      "retryAfter": 30,
      "fallbackAvailable": false
    }
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### Rate Limit Errors
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 100,
      "window": 900,
      "remaining": 0,
      "resetTime": "2024-01-15T16:00:00Z"
    }
  },
  "timestamp": "2024-01-15T15:45:00Z",
  "headers": {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "0", 
    "X-RateLimit-Reset": "1642248000"
  }
}
```

## Security Considerations

- All API endpoints require valid JWT tokens
- Role-based access control (RBAC) implemented
- GPS data encrypted in transit and at rest
- Rate limiting prevents abuse
- Input validation on all endpoints
- CORS configured for production domains
- No hardcoded credentials or super admin accounts
- File uploads scanned for malware
- Sensitive data (signatures, photos) stored securely
- API request/response logging for audit trails
- Automatic token refresh prevents session hijacking