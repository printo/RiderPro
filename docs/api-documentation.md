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
  "email": "user@company.com",
  "password": "userpassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "EMP001",
      "email": "user@company.com",
      "name": "John Doe",
      "role": "ops_team",
      "employeeId": "EMP001"
    }
  }
}
```

#### Token Refresh
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "userId": "EMP001",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Health Check

#### API Health
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z"
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
- `search` (string): Search in customer names and addresses
- `sortField` (string): Field to sort by
- `sortOrder` (string): ASC or DESC

**Example Request:**
```http
GET /api/shipments?page=1&limit=20&status=pending&type=delivery&routeName=Route%20A
```

**Response:**
```json
{
  "data": [
    {
      "id": "TRK1760428242357azj0q",
      "customerName": "Rajesh Kumar",
      "customerMobile": "+91-9876543210",
      "address": "456 Brigade Road, Bangalore, Karnataka 560025",
      "status": "delivered",
      "priority": "high",
      "type": "delivery",
      "routeName": "Bangalore Central",
      "employeeId": "EMP001",
      "weight": 2.5,
      "dimensions": "30x20x15 cm",
      "cost": 150.00,
      "deliveryTime": "2024-01-15T14:30:00.000Z",
      "actualDeliveryTime": "2024-01-15T15:45:00.000Z",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "pickupAddress": "Printo Store, 123 MG Road, Bangalore, Karnataka 560001",
      "specialInstructions": "Ring doorbell twice, deliver to security",
      "createdAt": "2024-01-15T08:00:00.000Z",
      "updatedAt": "2024-01-15T15:45:00.000Z"
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
  "shipment": {
    "id": "TRK1760428242357azj0q",
    "customerName": "Rajesh Kumar",
    "customerMobile": "+91-9876543210",
    "address": "456 Brigade Road, Bangalore, Karnataka 560025",
    "status": "delivered",
    "priority": "high",
    "type": "delivery",
    "routeName": "Bangalore Central",
    "employeeId": "EMP001",
    "weight": 2.5,
    "dimensions": "30x20x15 cm",
    "cost": 150.00,
    "deliveryTime": "2024-01-15T14:30:00.000Z",
    "actualDeliveryTime": "2024-01-15T15:45:00.000Z",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "pickupAddress": "Printo Store, 123 MG Road, Bangalore, Karnataka 560001",
    "specialInstructions": "Ring doorbell twice, deliver to security"
  },
  "acknowledgment": {
    "id": "ack_001",
    "shipmentId": "TRK1760428242357azj0q",
    "recipientName": "Rajesh Kumar",
    "signature": "/uploads/signatures/sig_001.png",
    "photo": "/uploads/photos/photo_001.jpg",
    "timestamp": "2024-01-15T15:45:00.000Z",
    "location": "12.9716,77.5946",
    "notes": "Package delivered to security guard as requested"
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
  "id": "TRK1760428242358bzk1r",
  "customerName": "Priya Sharma",
  "customerMobile": "+91-8765432109",
  "address": "789 Koramangala, Bangalore, Karnataka 560034",
  "status": "pending",
  "priority": "medium",
  "type": "pickup",
  "weight": 1.8,
  "dimensions": "25x15x10 cm",
  "deliveryTime": "2024-01-16T10:00:00.000Z",
  "specialInstructions": "Call before pickup",
  "routeName": "Bangalore South",
  "employeeId": "EMP002",
  "latitude": 12.9352,
  "longitude": 77.6245,
  "cost": 80.00,
  "pickupAddress": "789 Koramangala, Bangalore, Karnataka 560034"
}
```

**Response:**
```json
{
  "id": "TRK1760428242358bzk1r",
  "status": "pending",
  "createdAt": "2024-01-15T11:00:00.000Z",
  "message": "Shipment created successfully"
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
  "latitude": 40.7505,
  "longitude": -73.9934,
  "actualDeliveryTime": "2024-01-15T16:30:00.000Z",
  "specialInstructions": "Updated delivery instructions"
}
```

**Response:**
```json
{
  "id": "ship_001",
  "status": "in_transit",
  "updatedAt": "2024-01-15T12:00:00.000Z",
  "message": "Shipment updated successfully"
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
      "id": "ship_001",
      "status": "in_transit"
    },
    {
      "id": "ship_002",
      "status": "delivered",
      "actualDeliveryTime": "2024-01-15T17:00:00.000Z"
    }
  ]
}
```

**Response:**
```json
{
  "updatedCount": 2,
  "message": "Batch update completed successfully"
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
  "longitude": -74.0060
}
```

**Response:**
```json
{
  "success": true,
  "message": "Route session started successfully",
  "session": {
    "id": "session_001",
    "employeeId": "EMP001",
    "status": "active",
    "startTime": "2024-01-15T08:00:00.000Z",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060,
    "createdAt": "2024-01-15T08:00:00.000Z"
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
  "sessionId": "session_001",
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
    "id": "session_001",
    "employeeId": "EMP001",
    "status": "completed",
    "startTime": "2024-01-15T08:00:00.000Z",
    "endTime": "2024-01-15T17:00:00.000Z",
    "totalDistance": 45.2,
    "totalTime": 32400,
    "endLatitude": 40.7128,
    "endLongitude": -74.0060
  }
}
```

#### Get Active Session
```http
GET /api/routes/active/:employeeId
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_001",
    "employeeId": "EMP001",
    "status": "active",
    "startTime": "2024-01-15T08:00:00.000Z",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060
  }
}
```

#### Submit GPS Coordinates
```http
POST /api/routes/coordinates
```

**Request Body (Single Coordinate):**
```json
{
  "sessionId": "session_001",
  "employeeId": "EMP001",
  "latitude": 40.7589,
  "longitude": -73.9851,
  "timestamp": "2024-01-15T09:15:00.000Z",
  "accuracy": 5.2,
  "speed": 25.5,
  "heading": 180.0,
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "GPS coordinates recorded successfully",
  "record": {
    "id": "gps_001",
    "sessionId": "session_001",
    "employeeId": "EMP001",
    "latitude": 40.7589,
    "longitude": -73.9851,
    "timestamp": "2024-01-15T09:15:00.000Z",
    "accuracy": 5.2,
    "speed": 25.5
  }
}
```

#### Batch Submit GPS Coordinates
```http
POST /api/routes/coordinates/batch
```

**Request Body (Array of Coordinates):**
```json
{
  "coordinates": [
    {
      "sessionId": "session_001",
      "employeeId": "EMP001",
      "latitude": 40.7589,
      "longitude": -73.9851,
      "timestamp": "2024-01-15T09:15:00.000Z",
      "accuracy": 5.2,
      "speed": 25.5
    },
    {
      "sessionId": "session_001",
      "employeeId": "EMP001",
      "latitude": 40.7505,
      "longitude": -73.9934,
      "timestamp": "2024-01-15T09:16:00.000Z",
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
        "id": "gps_001",
        "sessionId": "session_001",
        "latitude": 40.7589,
        "longitude": -73.9851
      }
    },
    {
      "success": true,
      "record": {
        "id": "gps_002",
        "sessionId": "session_001",
        "latitude": 40.7505,
        "longitude": -73.9934
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
  "sessionId": "session_001",
  "shipmentId": "ship_001",
  "eventType": "delivery",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipment event recorded successfully",
  "record": {
    "id": "event_001",
    "sessionId": "session_001",
    "shipmentId": "ship_001",
    "eventType": "delivery",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timestamp": "2024-01-15T15:30:00.000Z"
  }
}
```

### Analytics

#### Get Route Analytics
```http
GET /api/routes/analytics
```

**Query Parameters:**
- `employeeId` (string): Filter by employee
- `date` (string): Filter by specific date (YYYY-MM-DD)
- `startDate` (string): Start date for range (YYYY-MM-DD)
- `endDate` (string): End date for range (YYYY-MM-DD)
- `sessionStatus` (string): Filter by session status

**Example Request:**
```http
GET /api/routes/analytics?employeeId=EMP001&startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "analytics": [
    {
      "routeId": "route_001",
      "employeeId": "EMP001",
      "date": "2024-01-15",
      "totalDistance": 45.2,
      "totalTime": 32400,
      "averageSpeed": 28.5,
      "fuelConsumption": 4.2,
      "fuelConsumed": 4.2,
      "fuelCost": 6.30,
      "stops": 8,
      "efficiency": 85.5,
      "shipmentsCompleted": 12
    }
  ],
  "count": 1
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
  "totalShipments": 150,
  "completed": 120,
  "inProgress": 25,
  "pending": 5,
  "deliveredShipments": 115,
  "inTransitShipments": 25,
  "pendingShipments": 10,
  "averageDeliveryTime": 45.5,
  "onTimeDeliveryRate": 92.3,
  "statusBreakdown": {
    "delivered": 115,
    "picked_up": 5,
    "in_transit": 25,
    "pending": 5,
    "cancelled": 0,
    "returned": 0
  },
  "typeBreakdown": {
    "delivery": 130,
    "pickup": 20
  },
  "routeBreakdown": {
    "Route A": {
      "total": 50,
      "delivered": 45,
      "pending": 5
    },
    "Route B": {
      "total": 40,
      "delivered": 35,
      "pending": 5
    }
  }
}
```

### File Upload (Acknowledgments)

#### Create Acknowledgment with Files
```http
POST /api/acknowledgments
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
```
shipmentId: ship_001
recipientName: John Smith
timestamp: 2024-01-15T15:45:00.000Z
location: 40.7128,-74.0060
notes: Package delivered successfully
signature: [file: signature.png]
photo: [file: delivery_photo.jpg]
```

**Response:**
```json
{
  "id": "ack_001",
  "shipmentId": "ship_001",
  "recipientName": "John Smith",
  "signature": "/uploads/signatures/sig_001.png",
  "photo": "/uploads/photos/photo_001.jpg",
  "timestamp": "2024-01-15T15:45:00.000Z",
  "location": "40.7128,-74.0060",
  "notes": "Package delivered successfully"
}
```

#### Get Acknowledgments for Shipment
```http
GET /api/acknowledgments/:shipmentId
```

**Response:**
```json
[
  {
    "id": "ack_001",
    "shipmentId": "ship_001",
    "recipientName": "John Smith",
    "signature": "/uploads/signatures/sig_001.png",
    "photo": "/uploads/photos/photo_001.jpg",
    "timestamp": "2024-01-15T15:45:00.000Z",
    "location": "40.7128,-74.0060",
    "notes": "Package delivered successfully"
  }
]
```

## External API Integration

### Printo Authentication Service

#### Login to Printo API
```http
POST https://pia.printo.in/api/v1/auth/
```

**Request Body:**
```json
{
  "email": "user@company.com",
  "password": "userpassword"
}
```

**Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "12345",
      "email": "user@company.com",
      "name": "John Doe",
      "role": "ops_team",
      "is_admin": false,
      "is_ops_team": true,
      "employee_id": "EMP001"
    }
  }
}
```

#### Refresh Printo Token
```http
POST https://pia.printo.in/api/v1/auth/refresh/
```

**Request Body:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## External System Integration

### Receiving Shipment Data from External Systems

#### Receive Single Shipment
```http
POST /api/shipments/receive
```

**Request Body (Single Shipment):**
```json
{
  "id": "TRK1760428242357azj0q",
  "status": "pending",
  "priority": "high",
  "type": "delivery",
  "pickupAddress": "Printo Store, 123 MG Road, Bangalore, Karnataka 560001",
  "deliveryAddress": "456 Brigade Road, Bangalore, Karnataka 560025",
  "recipientName": "Rajesh Kumar",
  "recipientPhone": "+91-9876543210",
  "customerName": "Rajesh Kumar",
  "customerMobile": "+91-9876543210",
  "address": "456 Brigade Road, Bangalore, Karnataka 560025",
  "weight": 2.5,
  "dimensions": "30x20x15 cm",
  "specialInstructions": "Ring doorbell twice, deliver to security",
  "estimatedDeliveryTime": "2024-01-15T14:30:00.000Z",
  "deliveryTime": "2024-01-15T14:30:00.000Z",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "cost": 150.00,
  "routeName": "Bangalore Central",
  "employeeId": "EMP001"
}
```

**Request Body (Batch Shipments):**
```json
{
  "shipments": [
    {
      "id": "TRK1760428242357azj0q",
      "status": "pending",
      "priority": "high",
      "type": "delivery",
      "pickupAddress": "Printo Store, 123 MG Road, Bangalore, Karnataka 560001",
      "deliveryAddress": "456 Brigade Road, Bangalore, Karnataka 560025",
      "recipientName": "Rajesh Kumar",
      "recipientPhone": "+91-9876543210",
      "customerName": "Rajesh Kumar",
      "customerMobile": "+91-9876543210",
      "address": "456 Brigade Road, Bangalore, Karnataka 560025",
      "weight": 2.5,
      "dimensions": "30x20x15 cm",
      "specialInstructions": "Ring doorbell twice",
      "estimatedDeliveryTime": "2024-01-15T14:30:00.000Z",
      "deliveryTime": "2024-01-15T14:30:00.000Z",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "cost": 150.00,
      "routeName": "Bangalore Central",
      "employeeId": "EMP001"
    },
    {
      "id": "TRK1760428242358bzk1r",
      "status": "pending",
      "priority": "medium",
      "type": "pickup",
      "pickupAddress": "789 Koramangala, Bangalore, Karnataka 560034",
      "deliveryAddress": "Printo Store, 123 MG Road, Bangalore, Karnataka 560001",
      "recipientName": "Priya Sharma",
      "recipientPhone": "+91-8765432109",
      "customerName": "Priya Sharma",
      "customerMobile": "+91-8765432109",
      "address": "789 Koramangala, Bangalore, Karnataka 560034",
      "weight": 1.2,
      "dimensions": "25x15x10 cm",
      "specialInstructions": "Call before pickup",
      "estimatedDeliveryTime": "2024-01-15T16:00:00.000Z",
      "deliveryTime": "2024-01-15T16:00:00.000Z",
      "latitude": 12.9352,
      "longitude": 77.6245,
      "cost": 80.00,
      "routeName": "Bangalore South",
      "employeeId": "EMP002"
    }
  ],
  "metadata": {
    "source": "printo_system",
    "batchId": "batch_20240115_001",
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipments processed successfully",
  "results": {
    "total": 2,
    "created": 2,
    "updated": 0,
    "failed": 0,
    "duplicates": 0
  },
  "processedShipments": [
    {
      "externalId": "TRK1760428242357azj0q",
      "internalId": "ship_001",
      "status": "created",
      "message": "Shipment created successfully"
    },
    {
      "externalId": "TRK1760428242358bzk1r",
      "internalId": "ship_002",
      "status": "created",
      "message": "Shipment created successfully"
    }
  ],
  "timestamp": "2024-01-15T10:00:30.000Z"
}
```

### Sending Updates to External Systems

#### Send Single Update to External System
```http
POST /api/shipments/update/external
```

**Request Body:**
```json
{
  "externalId": "TRK1760428242357azj0q",
  "webhookUrl": "https://external-system.com/webhook/shipment-updates"
}
```

**Payload Sent to External System:**
```json
{
  "externalId": "TRK1760428242357azj0q",
  "status": "delivered",
  "statusTimestamp": "2024-01-15T15:45:00.000Z",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "accuracy": 5.0
  },
  "employeeId": "EMP001",
  "employeeName": "Ravi Patel",
  "deliveryDetails": {
    "actualDeliveryTime": "2024-01-15T15:45:00.000Z",
    "recipientName": "Rajesh Kumar",
    "deliveryNotes": "Delivered to security guard",
    "signature": "/uploads/signatures/sig_001.png",
    "photo": "/uploads/photos/delivery_001.jpg"
  },
  "routeInfo": {
    "routeName": "Bangalore Central",
    "sessionId": "session_001",
    "totalDistance": 12.5,
    "travelTime": 1800
  }
}
```

#### Send Batch Updates to External System
```http
POST /api/shipments/update/external/batch
```

**Request Body:**
```json
{
  "updates": [
    {
      "externalId": "TRK1760428242357azj0q",
      "status": "delivered"
    },
    {
      "externalId": "TRK1760428242358bzk1r",
      "status": "in_transit"
    }
  ],
  "webhookUrl": "https://external-system.com/webhook/batch-updates"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch updates sent successfully",
  "results": {
    "total": 2,
    "successful": 2,
    "failed": 0
  },
  "updates": [
    {
      "externalId": "TRK1760428242357azj0q",
      "status": "sent",
      "message": "Update sent successfully"
    },
    {
      "externalId": "TRK1760428242358bzk1r",
      "status": "sent",
      "message": "Update sent successfully"
    }
  ],
  "timestamp": "2024-01-15T16:00:00.000Z"
}
```

### Field Mapping Documentation

#### External to Internal Field Mapping

When receiving shipment data from external systems, the following field mapping is applied:

| External Field | Internal Database Field | Description | Required |
|---|---|---|---|
| `id` | `id` | External tracking ID used as primary key | Yes |
| `recipientName` | `customerName` | Customer/recipient name | Yes |
| `recipientPhone` | `customerMobile` | Customer/recipient phone number | Yes |
| `deliveryAddress` | `address` | Primary delivery address | Yes |
| `estimatedDeliveryTime` | `deliveryTime` | Scheduled delivery time | Yes |
| `customerName` | `customerName` | Alias for recipientName | Yes |
| `customerMobile` | `customerMobile` | Alias for recipientPhone | Yes |
| `address` | `address` | Alias for deliveryAddress | Yes |
| `deliveryTime` | `deliveryTime` | Alias for estimatedDeliveryTime | Yes |
| `status` | `status` | Shipment status | Yes |
| `priority` | `priority` | Delivery priority (high/medium/low) | Yes |
| `type` | `type` | Shipment type (delivery/pickup) | Yes |
| `pickupAddress` | `pickupAddress` | Pickup location address | Yes |
| `weight` | `weight` | Package weight in kg | No |
| `dimensions` | `dimensions` | Package dimensions (LxWxH) | No |
| `specialInstructions` | `specialInstructions` | Delivery instructions | No |
| `latitude` | `latitude` | Delivery location latitude | No |
| `longitude` | `longitude` | Delivery location longitude | No |
| `cost` | `cost` | Delivery cost in INR | Yes |
| `routeName` | `routeName` | Assigned route name | Yes |
| `employeeId` | `employeeId` | Assigned employee ID | Yes |

#### Internal to External Field Mapping

When sending updates to external systems, the following fields are included:

| Internal Field | External Field | Description |
|---|---|---|
| `id` | `externalId` | Original external tracking ID |
| `status` | `status` | Current shipment status |
| `updatedAt` | `statusTimestamp` | Last update timestamp |
| `latitude` | `location.latitude` | Current/delivery latitude |
| `longitude` | `location.longitude` | Current/delivery longitude |
| `employeeId` | `employeeId` | Assigned employee ID |
| `actualDeliveryTime` | `deliveryDetails.actualDeliveryTime` | Actual delivery time |
| `customerName` | `deliveryDetails.recipientName` | Recipient name |
| `routeName` | `routeInfo.routeName` | Route name |

### Complete Field Reference

#### Database Schema Fields

The RiderPro database uses the following schema for shipments:

```sql
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,                    -- External tracking ID
  type TEXT NOT NULL,                     -- delivery, pickup
  customerName TEXT NOT NULL,             -- Customer/recipient name
  customerMobile TEXT NOT NULL,           -- Customer phone number
  address TEXT NOT NULL,                  -- Delivery address
  latitude REAL,                          -- Delivery location latitude
  longitude REAL,                         -- Delivery location longitude
  cost REAL NOT NULL,                     -- Delivery cost in INR
  deliveryTime TEXT NOT NULL,             -- Estimated delivery time
  routeName TEXT NOT NULL,                -- Assigned route name
  employeeId TEXT NOT NULL,               -- Assigned employee ID
  status TEXT NOT NULL DEFAULT 'pending', -- Shipment status
  priority TEXT,                          -- Delivery priority
  pickupAddress TEXT,                     -- Pickup location
  weight REAL,                            -- Package weight in kg
  dimensions TEXT,                        -- Package dimensions
  specialInstructions TEXT,               -- Delivery instructions
  actualDeliveryTime TEXT,                -- Actual delivery timestamp
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Valid Field Values

**Status Values:**
- `pending` - Shipment created, not yet assigned
- `assigned` - Assigned to employee and route
- `picked_up` - Package picked up from origin
- `in_transit` - Package in transit to destination
- `out_for_delivery` - Package out for final delivery
- `delivered` - Package successfully delivered
- `failed_delivery` - Delivery attempt failed
- `returned` - Package returned to sender
- `cancelled` - Shipment cancelled

**Priority Values:**
- `high` - High priority delivery
- `medium` - Medium priority delivery
- `low` - Low priority delivery

**Type Values:**
- `delivery` - Delivery from pickup to destination
- `pickup` - Pickup from customer location

**Indian Address Format Examples:**
```json
{
  "address": "456 Brigade Road, Bangalore, Karnataka 560025",
  "pickupAddress": "Printo Store, 123 MG Road, Bangalore, Karnataka 560001"
}
```

**Indian Phone Number Format:**
```json
{
  "customerMobile": "+91-9876543210"
}
```

**Currency Format (INR):**
```json
{
  "cost": 150.00
}
```

**Coordinate Ranges for India:**
```json
{
  "latitude": 12.9716,    // Range: 8.0 to 37.0
  "longitude": 77.5946    // Range: 68.0 to 97.0
}
```

### Webhook Authentication

#### Authentication Methods

**API Token Authentication:**
```http
Authorization: Bearer <webhook-token>
```

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Webhook-Source: riderpro
X-Webhook-Timestamp: 1642248000
X-Webhook-Signature: sha256=abc123...
```

#### Webhook Security

1. **Token Validation**: All webhook requests must include valid Bearer token
2. **Signature Verification**: Request body signed with HMAC-SHA256
3. **Timestamp Validation**: Requests older than 5 minutes are rejected
4. **Rate Limiting**: Maximum 100 requests per minute per webhook endpoint
5. **Retry Logic**: Failed webhooks are retried up to 3 times with exponential backoff

#### Webhook Configuration

```json
{
  "webhookConfig": {
    "url": "https://external-system.com/webhook/shipment-updates",
    "token": "webhook_token_here",
    "secret": "webhook_secret_for_signing",
    "retryAttempts": 3,
    "timeoutSeconds": 30,
    "enabledEvents": ["status_update", "delivery_complete", "pickup_complete"]
  }
}
```

### External System Integration Error Handling

#### Validation Errors for Shipment Reception

**Invalid Field Format:**
```json
{
  "success": false,
  "message": "Validation failed for shipment data",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "recipientPhone",
        "value": "invalid-phone",
        "message": "Phone number must be in format +91-XXXXXXXXXX"
      },
      {
        "field": "latitude",
        "value": "91.5",
        "message": "Latitude must be between -90 and 90"
      }
    ],
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

**Missing Required Fields:**
```json
{
  "success": false,
  "message": "Missing required fields",
  "error": {
    "code": "MISSING_FIELDS",
    "details": {
      "missingFields": ["customerName", "deliveryAddress", "employeeId"],
      "receivedFields": ["id", "status", "type"]
    },
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

**Duplicate Shipment:**
```json
{
  "success": false,
  "message": "Shipment with this ID already exists",
  "error": {
    "code": "DUPLICATE_SHIPMENT",
    "details": {
      "existingId": "TRK1760428242357azj0q",
      "existingStatus": "in_transit",
      "createdAt": "2024-01-15T08:00:00.000Z"
    },
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

#### Webhook Communication Errors

**External System Unavailable:**
```json
{
  "success": false,
  "message": "Failed to send update to external system",
  "error": {
    "code": "WEBHOOK_FAILED",
    "details": {
      "webhookUrl": "https://external-system.com/webhook",
      "httpStatus": 503,
      "retryAttempt": 2,
      "nextRetryAt": "2024-01-15T10:05:00.000Z"
    },
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

**Authentication Failed:**
```json
{
  "success": false,
  "message": "Webhook authentication failed",
  "error": {
    "code": "WEBHOOK_AUTH_FAILED",
    "details": {
      "reason": "Invalid or expired webhook token",
      "webhookUrl": "https://external-system.com/webhook"
    },
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

#### Rate Limiting for External Endpoints

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
X-RateLimit-Window: 900
```

**Rate Limit Exceeded:**
```json
{
  "success": false,
  "message": "Rate limit exceeded",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "limit": 100,
      "window": 900,
      "resetAt": "2024-01-15T10:15:00.000Z"
    },
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

### External System Integration Examples

#### Complete Integration Example

**Step 1: External System Sends Shipment Data**
```bash
curl -X POST https://riderpro-api.com/api/shipments/receive \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "id": "TRK1760428242357azj0q",
    "status": "pending",
    "priority": "high",
    "type": "delivery",
    "pickupAddress": "Printo Store, 123 MG Road, Bangalore, Karnataka 560001",
    "deliveryAddress": "456 Brigade Road, Bangalore, Karnataka 560025",
    "recipientName": "Rajesh Kumar",
    "recipientPhone": "+91-9876543210",
    "customerName": "Rajesh Kumar",
    "customerMobile": "+91-9876543210",
    "address": "456 Brigade Road, Bangalore, Karnataka 560025",
    "weight": 2.5,
    "dimensions": "30x20x15 cm",
    "specialInstructions": "Ring doorbell twice",
    "estimatedDeliveryTime": "2024-01-15T14:30:00.000Z",
    "deliveryTime": "2024-01-15T14:30:00.000Z",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "cost": 150.00,
    "routeName": "Bangalore Central",
    "employeeId": "EMP001"
  }'
```

**Step 2: RiderPro Processes and Responds**
```json
{
  "success": true,
  "message": "Shipment created successfully",
  "results": {
    "total": 1,
    "created": 1,
    "updated": 0,
    "failed": 0,
    "duplicates": 0
  },
  "processedShipments": [
    {
      "externalId": "TRK1760428242357azj0q",
      "internalId": "ship_001",
      "status": "created",
      "message": "Shipment created and assigned to route"
    }
  ],
  "timestamp": "2024-01-15T10:00:30.000Z"
}
```

**Step 3: RiderPro Sends Status Updates via Webhook**
```json
{
  "externalId": "TRK1760428242357azj0q",
  "status": "picked_up",
  "statusTimestamp": "2024-01-15T11:30:00.000Z",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "accuracy": 5.0
  },
  "employeeId": "EMP001",
  "employeeName": "Ravi Patel",
  "routeInfo": {
    "routeName": "Bangalore Central",
    "sessionId": "session_001"
  }
}
```

**Step 4: Final Delivery Update**
```json
{
  "externalId": "TRK1760428242357azj0q",
  "status": "delivered",
  "statusTimestamp": "2024-01-15T15:45:00.000Z",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "accuracy": 3.0
  },
  "employeeId": "EMP001",
  "employeeName": "Ravi Patel",
  "deliveryDetails": {
    "actualDeliveryTime": "2024-01-15T15:45:00.000Z",
    "recipientName": "Rajesh Kumar",
    "deliveryNotes": "Delivered to security guard as requested",
    "signature": "/uploads/signatures/sig_001.png",
    "photo": "/uploads/photos/delivery_001.jpg"
  },
  "routeInfo": {
    "routeName": "Bangalore Central",
    "sessionId": "session_001",
    "totalDistance": 12.5,
    "travelTime": 1800
  }
}
```

### Integration Flow Diagram

```
External System          RiderPro API              Database
      |                       |                       |
      |  POST /shipments/     |                       |
      |  receive              |                       |
      |---------------------->|                       |
      |                       |  Field Mapping &     |
      |                       |  Validation           |
      |                       |---------------------->|
      |                       |                       |
      |  Success Response     |  Store Shipment      |
      |<----------------------|<----------------------|
      |                       |                       |
      |                       |  Status Update       |
      |                       |<----------------------|
      |                       |                       |
      |  Webhook Update       |  POST /update/        |
      |<----------------------|  external             |
      |                       |                       |
```

### GPS Tracking Data Export

#### Route Session with GPS Points
```json
{
  "routeSession": {
    "id": "session_001",
    "employeeId": "EMP001",
    "startTime": "2024-01-15T08:00:00.000Z",
    "endTime": "2024-01-15T17:00:00.000Z",
    "totalDistance": 45.2,
    "totalDuration": 32400,
    "averageSpeed": 28.5,
    "gpsPoints": [
      {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "timestamp": "2024-01-15T08:00:00.000Z",
        "accuracy": 5.0,
        "speed": 0.0
      },
      {
        "latitude": 40.7589,
        "longitude": -73.9851,
        "timestamp": "2024-01-15T09:15:00.000Z",
        "accuracy": 4.8,
        "speed": 25.5
      }
    ],
    "shipmentEvents": [
      {
        "shipmentId": "ship_001",
        "eventType": "pickup",
        "latitude": 40.7589,
        "longitude": -73.9851,
        "timestamp": "2024-01-15T09:30:00.000Z"
      },
      {
        "shipmentId": "ship_001",
        "eventType": "delivery",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "timestamp": "2024-01-15T15:45:00.000Z"
      }
    ]
  }
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Human readable error message",
  "error": {
    "code": "ERROR_CODE",
    "details": {
      "field": "fieldName",
      "value": "invalidValue",
      "constraint": "validation rule"
    },
    "timestamp": "2024-01-15T10:00:00.000Z",
    "requestId": "req_12345"
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
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

### Validation Error Example

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "field": "latitude",
      "value": "91.5",
      "constraint": "Latitude must be between -90 and 90"
    }
  }
}
```

## Rate Limiting

- **Authentication**: 5 requests per minute per IP
- **Data Endpoints**: 100 requests per minute per user
- **GPS Points**: 1000 points per hour per session
- **File Uploads**: 10 requests per minute per user

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
X-RateLimit-Window: 900
```

## Pagination

All list endpoints support pagination with consistent format:

```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8,
  "hasNextPage": true,
  "hasPreviousPage": false
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
- File uploads are validated and sanitized
- SQL injection protection through parameterized queries