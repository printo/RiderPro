# API Documentation

## Base URL
- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

## Authentication

The system uses a modern, unified authentication system with automatic token management:

### Client-Side Integration
- **React Hook**: Use `useAuth()` hook for all authentication needs
- **API Client**: Use `apiClient` for all authenticated requests
- **Automatic Headers**: Authentication headers added automatically
- **Token Refresh**: Seamless token renewal on expiration

```typescript
// React component usage
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/ApiClient';

const { user, isAuthenticated, login, logout } = useAuth();

// API calls with automatic authentication
const response = await apiClient.get('/api/shipments');
```

### Server Integration
- **Django Authentication**: Proxied via `/api/auth/login` to `https://pia.printo.in/api/v1/auth/`
- **Token Storage**: Secure storage of `access_token`, `refresh_token`, and user data
- **Authorization Headers**: `Authorization: Bearer <access-token>` sent automatically
- **Auto-Refresh**: Automatic token refresh on 401 responses via `/api/auth/refresh`

## Authentication Endpoints

### Login
**POST** `/api/auth/login`

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
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      "id": "employee123",
      "username": "user@company.com",
      "email": "user@company.com",
      "role": "ops_team",
      "employeeId": "employee123",
      "fullName": "User Name",
      "isActive": true,
      "lastLogin": "2024-01-15T10:00:00Z",
      "permissions": [
        "view_all_routes",
        "view_analytics",
        "export_data",
        "view_live_tracking"
      ],
      "isOpsTeam": true,
      "isAdmin": false,
      "isSuperAdmin": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Get Current User
**GET** `/api/auth/me`

**Headers:**
```
Authorization: Bearer <access-token>
```

### Logout
**POST** `/api/auth/logout`

**Headers:**
```
Authorization: Bearer <access-token>
```

## Data Endpoints

All data endpoints require authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access-token>
```

### Shipments

#### Get All Shipments
**GET** `/api/shipments`

**Query Parameters:**
- `status` (optional): Filter by shipment status
- `type` (optional): Filter by shipment type (delivery/pickup)
- `employeeId` (optional): Filter by employee ID
- `routeName` (optional): Filter by route name

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "shipment123",
      "type": "delivery",
      "customerName": "John Doe",
      "customerMobile": "+1234567890",
      "address": "123 Main St, City",
      "cost": 25.50,
      "deliveryTime": "2024-01-15T14:30:00Z",
      "routeName": "Route A",
      "employeeId": "emp123",
      "status": "Assigned",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### Get Single Shipment
**GET** `/api/shipments/:id`

#### Update Shipment Status
**PATCH** `/api/shipments/:id/status`

**Request Body:**
```json
{
  "status": "Delivered",
  "remarks": "Package delivered successfully"
}
```

#### Batch Update Shipments
**PATCH** `/api/shipments/batch`

**Request Body:**
```json
{
  "shipmentIds": ["id1", "id2", "id3"],
  "status": "In Transit",
  "remarks": "Batch update - out for delivery"
}
```

### Location-Based Endpoints

#### Get Nearby Shipments
**GET** `/api/shipments/near`

**Query Parameters:**
- `latitude` (required): Latitude coordinate (-90 to 90)
- `longitude` (required): Longitude coordinate (-180 to 180)  
- `radius` (optional): Search radius in kilometers (default: 5, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "shipment123",
      "customerName": "John Doe",
      "address": "123 Main St",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "distance": 2.5,
      "status": "Assigned"
    }
  ],
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radius": 5
  },
  "count": 1
}
```

#### Get Shipments With Location
**GET** `/api/shipments/with-location`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "shipment123",
      "customerName": "John Doe",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "status": "Assigned"
    }
  ],
  "count": 1
}
```

#### Get Shipments Without Location
**GET** `/api/shipments/without-location`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "shipment456",
      "customerName": "Jane Smith",
      "latitude": null,
      "longitude": null,
      "status": "Assigned"
    }
  ],
  "count": 1
}
```

#### Update Shipment Location
**PATCH** `/api/shipments/:id/location`

**Request Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "shipment123",
    "customerName": "John Doe",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "status": "Assigned"
  },
  "message": "Shipment location updated successfully"
}
```

### Acknowledgments

#### Create Acknowledgment
**POST** `/api/acknowledgments`

**Request Body (multipart/form-data):**
- `shipmentId`: string
- `signature`: file (optional)
- `photo`: file (optional)

#### Get Acknowledgments for Shipment
**GET** `/api/acknowledgments/:shipmentId`

### Dashboard

#### Get Dashboard Metrics
**GET** `/api/dashboard/metrics`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalShipments": 150,
    "deliveredToday": 45,
    "inTransit": 32,
    "pending": 73,
    "routeMetrics": [
      {
        "routeName": "Route A",
        "total": 25,
        "delivered": 15,
        "pending": 10
      }
    ]
  }
}
```

### External Sync

#### Trigger Manual Sync
**POST** `/api/sync/trigger`

#### Get Sync Status
**GET** `/api/sync/status`

**Response:**
```json
{
  "success": true,
  "data": {
    "lastSync": "2024-01-15T12:00:00Z",
    "pendingCount": 5,
    "failedCount": 2,
    "recentFailures": [
      {
        "shipmentId": "ship123",
        "error": "Network timeout",
        "attempts": 3,
        "lastAttempt": "2024-01-15T11:45:00Z"
      }
    ]
  }
}
```

## Error Handling

All API endpoints return structured error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid shipment status",
    "details": {
      "field": "status",
      "allowedValues": ["Assigned", "In Transit", "Delivered", "Picked Up", "Returned", "Cancelled"]
    }
  }
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED`: Missing or invalid authentication token
- `AUTHORIZATION_FAILED`: Insufficient permissions for the requested operation
- `VALIDATION_ERROR`: Request data validation failed
- `NOT_FOUND`: Requested resource not found
- `EXTERNAL_API_ERROR`: External service integration failure
- `DATABASE_ERROR`: Database operation failed

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Authentication endpoints**: 5 requests per minute per IP
- **Data endpoints**: 100 requests per minute per authenticated user
- **File upload endpoints**: 10 requests per minute per authenticated user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```