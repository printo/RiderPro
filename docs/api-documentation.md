# API Documentation - RiderPro Route Tracking System

## Overview
This document provides comprehensive documentation for all API endpoints in the RiderPro system, including server-side routes, Supabase integration, authentication, data models, and client-side integration patterns. The system leverages Supabase as the primary backend with PostgreSQL database, real-time subscriptions, and built-in authentication.

## Table of Contents
1. [Supabase Integration](#supabase-integration)
2. [Authentication & User Management](#authentication--user-management)
3. [System Health & Monitoring](#system-health--monitoring)
4. [Shipment Management](#shipment-management)
5. [Route Tracking & GPS](#route-tracking--gps)
6. [Vehicle Types Management](#vehicle-types-management)
7. [Fuel Settings Management](#fuel-settings-management)
8. [External System Integration](#external-system-integration)
9. [File Upload & Acknowledgments](#file-upload--acknowledgments)
10. [Dashboard & Analytics](#dashboard--analytics)
11. [Error Handling](#error-handling)
12. [Data Models](#data-models)
13. [Rate Limiting & Security](#rate-limiting--security)

## Supabase Integration

### Supabase Client Setup

RiderPro uses Supabase as the primary backend service:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
```

### Real-time Subscriptions

#### Shipment Updates
```typescript
// Subscribe to shipment changes
const subscription = supabase
  .channel('shipments')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'shipments' },
    (payload) => {
      console.log('Shipment updated:', payload)
      // Update UI with real-time data
    }
  )
  .subscribe()
```

#### Route Tracking Updates
```typescript
// Subscribe to GPS tracking updates
const routeSubscription = supabase
  .channel('route-tracking')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'route_tracking' },
    (payload) => {
      console.log('New GPS point:', payload.new)
      // Add GPS point to map
    }
  )
  .subscribe()
```

### Database Operations

#### Query Shipments
```typescript
// Get shipments with filters
const { data: shipments, error } = await supabase
  .from('shipments')
  .select('*')
  .eq('status', 'Assigned')
  .eq('employeeId', userId)
  .order('createdAt', { ascending: false })
  .limit(20)

if (error) throw error
```

#### Insert New Shipment
```typescript
// Create new shipment
const { data: shipment, error } = await supabase
  .from('shipments')
  .insert({
    shipment_id: 'SHIP001',
    type: 'delivery',
    customerName: 'John Doe',
    customerMobile: '+1234567890',
    address: '123 Main St',
    status: 'Assigned',
    employeeId: userId
  })
  .select()
  .single()

if (error) throw error
```

#### Update Shipment
```typescript
// Update shipment status
const { data: shipment, error } = await supabase
  .from('shipments')
  .update({ 
    status: 'Delivered',
    actualDeliveryTime: new Date().toISOString()
  })
  .eq('id', shipmentId)
  .select()
  .single()

if (error) throw error
```

### File Storage

#### Upload Files
```typescript
// Upload signature or photo
const uploadFile = async (file: File, path: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from('shipment-files')
    .upload(path, file)
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('shipment-files')
    .getPublicUrl(path)
  
  return urlData.publicUrl;
};
```

#### Download Files
```typescript
// Download file
const downloadFile = async (path: string): Promise<Blob> => {
  const { data, error } = await supabase.storage
    .from('shipment-files')
    .download(path)
  
  if (error) throw error;
  return data;
};
```

## Authentication & User Management

### Supabase Authentication

RiderPro uses Supabase Auth for user authentication and management:

#### Sign Up with Email
```typescript
// Register new user
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe',
      rider_id: 'RIDER001',
      role: 'driver'
    }
  }
})

if (error) throw error
```

#### Sign In with Email
```typescript
// Login user
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

if (error) throw error
```

#### Sign Out
```typescript
// Logout user
const { error } = await supabase.auth.signOut()
if (error) throw error
```

#### Get Current User
```typescript
// Get current authenticated user
const { data: { user }, error } = await supabase.auth.getUser()
if (error) throw error
```

### User Registration & Login

#### Register New User
- **POST** `/api/auth/register`
- **Purpose**: Register new local users (requires admin approval)
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "riderId": "string",
    "password": "string",
    "fullName": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "userId": "string"
  }
  ```
- **Security**: Passwords hashed with bcrypt (12 salt rounds)

#### Local Login
- **POST** `/api/auth/local-login`
- **Purpose**: Login with local database credentials
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "riderId": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "accessToken": "local_<timestamp>_<userId>",
    "refreshToken": "refresh_<timestamp>_<random>",
    "fullName": "string",
    "isApproved": boolean
  }
  ```
- **Security**: bcrypt password verification
- **Token Format**: Access token contains embedded user ID for validation
- **Storage**: Tokens stored in localStorage only (no database storage)

### Authentication Architecture

#### Token-Based Authentication
- **Token Format**: `local_<timestamp>_<userId>` (embedded user ID)
- **Validation**: Extract user ID from token and validate against `rider_accounts` table
- **Role-Based Permissions**: Derived from `role` column in database
- **No Database Token Storage**: Tokens stored only in localStorage for efficiency

#### Role-Based Access Control
- **Super User**: `role = 'super_user'` or `'admin'` → Full system access
- **Ops Team**: `role = 'ops_team'` → Management-level access  
- **Staff**: `role = 'staff'` → Limited management access
- **Driver**: `role = 'driver'` or default → Basic driver access

### Admin User Management

#### Get Pending Approvals
- **GET** `/api/auth/pending-approvals`
- **Purpose**: Get list of users awaiting approval
- **Authentication**: Admin required

#### User Management UI Features
- **Conditional Pending Section**: Shows pending user approvals only when users are awaiting approval
- **Separate Management Sections**: 
  - "Pending User Approvals" section with orange color coding
  - "All Users Management" section with integrated refresh functionality
- **Enhanced Refresh Button**: Located in All Users Management section with loading states
- **Visual Hierarchy**: Color-coded sections (orange for pending, standard for all users)
- **Improved Loading States**: Better feedback for data loading operations
- **Response**:
  ```json
  {
    "pendingUsers": [
      {
        "id": "string",
        "riderId": "string",
        "fullName": "string",
        "createdAt": "string"
      }
    ]
  }
  ```

#### Approve User
- **POST** `/api/auth/approve/:userId`
- **Purpose**: Approve a pending user registration
- **Authentication**: Admin required
- **Response**:
  ```json
  {
    "success": true,
    "message": "User approved successfully"
  }
  ```

#### Reject User
- **POST** `/api/auth/reject/:userId`
- **Purpose**: Reject a pending user registration
- **Authentication**: Admin required
- **Response**:
  ```json
  {
    "success": true,
    "message": "User rejected successfully"
  }
  ```

#### Reset User Password
- **POST** `/api/auth/reset-password/:userId`
- **Purpose**: Reset a user's password (admin only)
- **Authentication**: Admin required
- **Response**:
  ```json
  {
    "success": true,
    "message": "Password reset successfully"
  }
  ```

## System Health & Monitoring

### Health Check
- **GET** `/api/health`
- **Purpose**: System health monitoring with caching and rate limiting
- **Rate Limit**: 10 requests per minute per IP
- **Cache**: 10 seconds TTL
- **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 3600,
    "database": "connected",
    "version": "1.0.0"
  }
  ```

### Dashboard Metrics
- **GET** `/api/dashboard`
- **Purpose**: Get dashboard metrics and statistics
- **Authentication**: None required
- **Response**:
  ```json
  {
    "totalShipments": 100,
    "completed": 80,
    "inProgress": 15,
    "pending": 5,
    "statusBreakdown": {
      "Delivered": 80,
      "In Transit": 15,
      "Assigned": 5
    },
    "typeBreakdown": {
      "delivery": 90,
      "pickup": 10
    },
    "routeBreakdown": {
      "Route A": {
        "total": 50,
        "delivered": 40,
        "pickedUp": 0,
        "pending": 10
      }
    }
  }
  ```

## Shipment Management

### Get Shipments
- **GET** `/api/shipments/fetch`
- **Purpose**: Get shipments with optional filters, pagination, and sorting
- **Authentication**: Required (Bearer token)
- **Query Parameters**:
  - `status`: Filter by shipment status
  - `priority`: Filter by priority level
  - `type`: Filter by shipment type (delivery/pickup)
  - `routeName`: Filter by route name
  - `date`: Filter by delivery date
  - `search`: Search in customer name/mobile/address
  - `employeeId`: Filter by assigned employee
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20)
  - `sortBy`: Sort field (default: createdAt)
  - `sortOrder`: Sort direction (asc/desc)
- **Response**:
  ```json
  {
    "data": [
      {
        "shipment_id": "string",
        "type": "delivery",
        "customerName": "string",
        "customerMobile": "string",
        "address": "string",
        "latitude": 0.0,
        "longitude": 0.0,
        "cost": 0.0,
        "deliveryTime": "string",
        "routeName": "string",
        "employeeId": "string",
        "status": "Assigned",
        "priority": "medium",
        "pickupAddress": "string",
        "weight": 0.0,
        "dimensions": "string",
        "specialInstructions": "string",
        "actualDeliveryTime": "string",
        "start_latitude": 0.0,
        "start_longitude": 0.0,
        "stop_latitude": 0.0,
        "stop_longitude": 0.0,
        "km_travelled": 0.0,
        "synced_to_external": false,
        "last_sync_attempt": "string",
        "sync_error": "string",
        "sync_status": "pending",
        "sync_attempts": 0,
        "signature_url": "string",
        "photo_url": "string",
        "acknowledgment_captured_at": "string",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
  ```

### Get Single Shipment
- **GET** `/api/shipments/:id`
- **Purpose**: Get a specific shipment by ID
- **Authentication**: None required
- **Response**: Single shipment object (same structure as above)

### Create Shipment
- **POST** `/api/shipments/create`
- **Purpose**: Create a new shipment
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "shipment_id": "string",
    "trackingNumber": "string",
    "type": "delivery",
    "customerName": "string",
    "customerMobile": "string",
    "address": "string",
    "latitude": 0.0,
    "longitude": 0.0,
    "cost": 0.0,
    "deliveryTime": "string",
    "routeName": "string",
    "employeeId": "string",
    "status": "Assigned",
    "priority": "medium",
    "pickupAddress": "string",
    "weight": 0.0,
    "dimensions": "string",
    "specialInstructions": "string"
  }
  ```

### Update Shipment Tracking
- **PATCH** `/api/shipments/:id/tracking`
- **Purpose**: Update shipment tracking data
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "start_latitude": 0.0,
    "start_longitude": 0.0,
    "stop_latitude": 0.0,
    "stop_longitude": 0.0,
    "km_travelled": 0.0,
    "status": "string",
    "actualDeliveryTime": "string"
  }
  ```

### Update Single Shipment
- **PATCH** `/api/shipments/:id`
- **Purpose**: Update a specific shipment
- **Authentication**: None required
- **Request Body**: Partial shipment object with fields to update

### Batch Update Shipments
- **PATCH** `/api/shipments/batch`
- **Purpose**: Update multiple shipments in a single request
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "updates": [
      {
        "shipment_id": "string",
        "status": "Delivered",
        "actualDeliveryTime": "string"
      }
    ]
  }
  ```

### Delete Shipment
- **DELETE** `/api/shipments/:id`
- **Purpose**: Delete a shipment (admin only)
- **Authentication**: Admin required
- **Response**:
  ```json
  {
    "message": "Shipment deleted successfully"
  }
  ```

## Route Tracking & GPS

### Start Route Session
- **POST** `/api/routes/start`
- **Purpose**: Start a new route tracking session
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "employeeId": "string",
    "startLatitude": 0.0,
    "startLongitude": 0.0,
    "vehicleType": "string",
    "routeName": "string"
  }
  ```

### Stop Route Session
- **POST** `/api/routes/stop`
- **Purpose**: Stop an active route session
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "sessionId": "string",
    "endLatitude": 0.0,
    "endLongitude": 0.0,
    "totalDistance": 0.0,
    "totalTime": 0.0
  }
  ```

### Submit GPS Coordinates
- **POST** `/api/routes/coordinates`
- **Purpose**: Submit GPS coordinates for a route session
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "sessionId": "string",
    "latitude": 0.0,
    "longitude": 0.0,
    "accuracy": 0.0,
    "speed": 0.0,
    "heading": 0.0,
    "timestamp": "string"
  }
  ```

### Batch Submit GPS Coordinates
- **POST** `/api/routes/coordinates/batch`
- **Purpose**: Submit multiple GPS coordinates for offline sync
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "sessionId": "string",
    "coordinates": [
      {
        "latitude": 0.0,
        "longitude": 0.0,
        "accuracy": 0.0,
        "speed": 0.0,
        "heading": 0.0,
        "timestamp": "string"
      }
    ]
  }
  ```

### Record Shipment Event
- **POST** `/api/routes/shipment-event`
- **Purpose**: Record pickup/delivery event for a session
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "sessionId": "string",
    "shipmentId": "string",
    "eventType": "pickup|delivery",
    "latitude": 0.0,
    "longitude": 0.0,
    "timestamp": "string",
    "notes": "string"
  }
  ```

### Get Session Data
- **GET** `/api/routes/session/:sessionId`
- **Purpose**: Get route session data and statistics
- **Authentication**: None required
- **Response**:
  ```json
  {
    "sessionId": "string",
    "employeeId": "string",
    "startTime": "string",
    "endTime": "string",
    "status": "active|completed",
    "totalDistance": 0.0,
    "totalTime": 0.0,
    "coordinates": [
      {
        "latitude": 0.0,
        "longitude": 0.0,
        "timestamp": "string"
      }
    ]
  }
  ```

### Sync Offline Session
- **POST** `/api/routes/sync-session`
- **Purpose**: Sync a route session created while offline
- **Authentication**: None required

### Sync Offline Coordinates
- **POST** `/api/routes/sync-coordinates`
- **Purpose**: Sync GPS coordinates captured while offline
- **Authentication**: None required

## Vehicle Types Management

### Get Vehicle Types
- **GET** `/api/vehicle-types`
- **Purpose**: Get all available vehicle types
- **Authentication**: None required
- **Response**:
  ```json
  [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "icon": "string",
      "fuel_type": "petrol|diesel|electric",
      "co2_emissions": 0.0,
      "created_at": "string",
      "updated_at": "string"
    }
  ]
  ```

### Get Vehicle Type by ID
- **GET** `/api/vehicle-types/:id`
- **Purpose**: Get a specific vehicle type
- **Authentication**: None required

### Create Vehicle Type
- **POST** `/api/vehicle-types`
- **Purpose**: Create a new vehicle type
- **Authentication**: Admin required
- **Request Body**:
  ```json
  {
    "name": "string",
    "description": "string",
    "icon": "string",
    "fuel_type": "petrol",
    "co2_emissions": 0.0
  }
  ```

### Update Vehicle Type
- **PUT** `/api/vehicle-types/:id`
- **Purpose**: Update a vehicle type
- **Authentication**: Admin required

### Delete Vehicle Type
- **DELETE** `/api/vehicle-types/:id`
- **Purpose**: Delete a vehicle type
- **Authentication**: Admin required

## Fuel Settings Management

### Get Fuel Settings
- **GET** `/api/fuel-settings`
- **Purpose**: Get all fuel price settings
- **Authentication**: None required
- **Response**:
  ```json
  [
    {
      "id": "string",
      "fuel_type": "petrol|diesel|electric|hybrid",
      "price_per_liter": 100.0,
      "currency": "INR",
      "region": "Bangalore|Chennai|Gurgaon|Hyderabad|Pune",
      "effective_date": "2024-01-01",
      "is_active": true,
      "created_by": "string",
      "created_at": "string",
      "updated_at": "string"
    }
  ]
  ```

### Get Fuel Setting by ID
- **GET** `/api/fuel-settings/:id`
- **Purpose**: Get a specific fuel setting
- **Authentication**: None required

### Create Fuel Setting
- **POST** `/api/fuel-settings`
- **Purpose**: Create a new fuel price setting
- **Authentication**: Admin required
- **Request Body**:
  ```json
  {
    "fuel_type": "petrol",
    "price_per_liter": 100.0,
    "currency": "INR",
    "region": "Bangalore",
    "effective_date": "2024-01-01",
    "is_active": true,
    "created_by": "admin"
  }
  ```

### Update Fuel Setting
- **PUT** `/api/fuel-settings/:id`
- **Purpose**: Update a fuel price setting
- **Authentication**: Admin required
- **Request Body**:
  ```json
  {
    "fuel_type": "petrol",
    "price_per_liter": 105.0,
    "currency": "INR",
    "region": "Bangalore",
    "effective_date": "2024-02-01",
    "is_active": true
  }
  ```

### Delete Fuel Setting
- **DELETE** `/api/fuel-settings/:id`
- **Purpose**: Delete a fuel price setting
- **Authentication**: Admin required

#### Fuel Settings UI Features
- **Current Settings Display**: Shows active fuel prices with automatic refresh
- **Error Handling**: Retry functionality for failed API calls
- **Loading States**: Proper loading indicators and error messages
- **Real-time Updates**: Automatic data refresh with 5-minute cache

## External System Integration

### Sync Single Shipment
- **POST** `/api/shipments/:id/sync`
- **Purpose**: Sync a shipment to external system
- **Authentication**: None required
- **Response**:
  ```json
  {
    "success": true,
    "message": "Shipment synced successfully",
    "syncedAt": "string",
    "externalId": "string"
  }
  ```

### Batch Sync Shipments
- **POST** `/api/shipments/batch-sync`
- **Purpose**: Sync multiple shipments to external system
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "shipmentIds": ["string"]
  }
  ```

### Get Sync Status
- **GET** `/api/shipments/sync-status`
- **Purpose**: Get sync status for shipments
- **Authentication**: None required
- **Query Parameters**:
  - `shipmentId`: Filter by specific shipment
  - `status`: Filter by sync status (pending/success/failed)
- **Response**:
  ```json
  {
    "syncStatus": [
      {
        "shipmentId": "string",
        "externalId": "string",
        "status": "success|failed|pending",
        "lastAttempt": "string",
        "error": "string"
      }
    ]
  }
  ```

### Receive External Shipment
- **POST** `/api/shipments/receive`
- **Purpose**: Receive shipment data from external system
- **Authentication**: Webhook authentication required
- **Request Body**:
  ```json
  {
    "shipments": [
      {
        "id": "string",
        "status": "string",
        "priority": "string",
        "type": "string",
        "pickupAddress": "string",
        "deliveryAddress": "string",
        "recipientName": "string",
        "recipientPhone": "string",
        "weight": 0.0,
        "dimensions": "string",
        "specialInstructions": "string",
        "estimatedDeliveryTime": "string",
        "latitude": 0.0,
        "longitude": 0.0,
        "cost": 0.0,
        "routeName": "string",
        "employeeId": "string"
      }
    ]
  }
  ```

### Send External Update
- **POST** `/api/shipments/update/external`
- **Purpose**: Send single shipment update to external system
- **Authentication**: Webhook authentication required

### Send Batch External Updates
- **POST** `/api/shipments/update/external/batch`
- **Purpose**: Send batch shipment updates to external system
- **Authentication**: Webhook authentication required

## File Upload & Acknowledgments

### Upload Acknowledgment
- **POST** `/api/shipments/:id/acknowledgement`
- **Purpose**: Upload acknowledgment with photo and signature
- **Authentication**: None required
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `photo`: Image file (optional)
  - `signatureData`: Base64 signature data (optional)
  - `remarks`: Text remarks (optional)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Acknowledgment uploaded successfully",
    "acknowledgment": {
      "signatureUrl": "string",
      "photoUrl": "string",
      "remarks": "string",
      "timestamp": "string"
    }
  }
  ```

### Add Shipment Remarks
- **POST** `/api/shipments/:id/remarks`
- **Purpose**: Add remarks for cancelled/returned shipments
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "remarks": "string",
    "status": "Cancelled|Returned"
  }
  ```

## Sync Management

### Get Sync Statistics
- **GET** `/api/sync/stats`
- **Purpose**: Get sync statistics and health
- **Authentication**: None required
- **Response**:
  ```json
  {
    "totalRecords": 1000,
    "syncedRecords": 950,
    "pendingRecords": 50,
    "failedRecords": 0,
    "lastSyncTime": "string",
    "syncHealth": "healthy"
  }
  ```

### Trigger Manual Sync
- **POST** `/api/sync/trigger`
- **Purpose**: Trigger manual sync process
- **Authentication**: Admin required
- **Response**:
  ```json
  {
    "success": true,
    "message": "Sync triggered successfully",
    "syncId": "string"
  }
  ```

## Dashboard & Analytics

### Dashboard Metrics
- **GET** `/api/dashboard`
- **Purpose**: Get real-time dashboard metrics and analytics data
- **Authentication**: Required (Bearer token)
- **Response**:
  ```json
  {
    "totalShipments": 150,
    "deliveredCount": 120,
    "pendingCount": 20,
    "cancelledCount": 10,
    "statusBreakdown": {
      "Delivered": 120,
      "In Transit": 15,
      "Assigned": 5,
      "Cancelled": 10
    },
    "routeBreakdown": {
      "Route A": {
        "total": 50,
        "delivered": 45,
        "pickedUp": 0,
        "pending": 5,
        "cancelled": 0
      },
      "Route B": {
        "total": 60,
        "delivered": 50,
        "pickedUp": 5,
        "pending": 3,
        "cancelled": 2
      }
    }
  }
  ```

### Status Distribution Analytics
- **Purpose**: Power pie chart visualizations with real-time data
- **Data Source**: Aggregated from shipments table
- **Features**:
  - Color-coded status indicators
  - Percentage calculations
  - Hover effects and interactions
  - Empty state handling

### Route Performance Analytics
- **Purpose**: Route-specific performance metrics
- **Features**:
  - Dynamic route loading from database
  - Performance comparison charts
  - Completion rate calculations
  - Responsive grid layouts

### Mobile-Responsive Design
- **Breakpoints**: `sm:`, `lg:`, `xl:` responsive breakpoints
- **Tab Navigation**: Mobile-optimized tab layouts
- **Touch Interactions**: 44px minimum touch targets
- **Performance**: Optimized rendering for mobile devices

## Error Handling

### Log Error
- **POST** `/api/errors`
- **Purpose**: Log application errors
- **Authentication**: None required
- **Request Body**:
  ```json
  {
    "message": "string",
    "stack": "string",
    "url": "string",
    "userAgent": "string",
    "timestamp": "string"
  }
  ```

## Data Models

### Shipment Model
```typescript
interface Shipment {
  shipment_id: string;           // Primary key
  type: string;                  // "delivery" | "pickup"
  customerName: string;
  customerMobile: string;
  address: string;
  latitude?: number;
  longitude?: number;
  cost: number;
  deliveryTime: string;
  routeName: string;
  employeeId: string;
  status: string;                // "Assigned" | "In Transit" | "Delivered" | etc.
  priority: string;              // "low" | "medium" | "high"
  pickupAddress?: string;
  weight: number;
  dimensions?: string;
  specialInstructions?: string;
  actualDeliveryTime?: string;
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled: number;
  synced_to_external: boolean;
  last_sync_attempt?: string;
  sync_error?: string;
  sync_status: string;           // "pending" | "success" | "failed"
  sync_attempts: number;
  signature_url?: string;
  photo_url?: string;
  acknowledgment_captured_at?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Route Session Model
```typescript
interface RouteSession {
  id: string;
  employee_id: string;
  start_time: string;
  end_time?: string;
  status: string;                // "active" | "completed" | "paused"
  start_latitude: number;
  start_longitude: number;
  end_latitude?: number;
  end_longitude?: number;
  total_distance?: number;
  total_time?: number;
  vehicle_type?: string;
  route_name?: string;
  created_at: string;
  updated_at: string;
}
```

### GPS Tracking Model
```typescript
interface RouteTracking {
  id: string;
  session_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  date: string;
  created_at: string;
}
```

### Vehicle Type Model
```typescript
interface VehicleType {
  id: string;
  name: string;
  description?: string;
  icon: string;
  fuel_type: string;             // "petrol" | "diesel" | "electric"
  co2_emissions?: number;
  created_at: string;
  updated_at: string;
}
```

## Rate Limiting & Security

### Rate Limits
- **Health Check**: 10 requests per minute per IP
- **Authentication**: 5 requests per minute per IP
- **File Upload**: 10 requests per minute per user
- **API Endpoints**: 100 requests per minute per authenticated user

### Authentication Methods
1. **Bearer Token**: For authenticated endpoints
2. **Webhook Authentication**: For external system integration
3. **Admin Authentication**: For administrative operations

### Security Features
- Password hashing with bcrypt (12 salt rounds)
- JWT tokens for session management
- CORS enabled for cross-origin requests
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting to prevent abuse

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  }
}
```

### Success Response Format
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

## Database Schema

The system uses Supabase (PostgreSQL) as the primary database:

### Key Tables
- `shipments`: Main shipment data with consolidated sync and acknowledgment fields
- `route_sessions`: Route tracking sessions
- `route_tracking`: GPS coordinate tracking data
- `user_profiles`: User profiles and authentication data (linked to Supabase Auth)
- `vehicle_types`: Available vehicle types
- `fuel_settings`: Fuel price settings for different regions
- `system_health_metrics`: System monitoring data
- `feature_flags`: Feature toggle configuration
- `system_config`: System configuration settings

### Supabase Features
- **Row Level Security (RLS)**: Built-in data access control
- **Real-time Subscriptions**: Live data updates via WebSocket
- **Automatic Backups**: Daily backups with point-in-time recovery
- **Scalability**: Automatic scaling based on usage
- **CDN Integration**: Global content delivery for static assets

## Integration Examples

### Supabase Client Usage
```typescript
// Get shipments with filters using Supabase
const { data: shipments, error } = await supabase
  .from('shipments')
  .select('*')
  .eq('status', 'Assigned')
  .eq('employeeId', 'EMP001')
  .order('createdAt', { ascending: false })
  .limit(20);

if (error) throw error;

// Update shipment status using Supabase
const { data: updatedShipment, error: updateError } = await supabase
  .from('shipments')
  .update({ 
    status: 'Delivered',
    actualDeliveryTime: new Date().toISOString()
  })
  .eq('id', shipmentId)
  .select()
  .single();

if (updateError) throw updateError;

// Start route session using Supabase
const { data: session, error: sessionError } = await supabase
  .from('route_sessions')
  .insert({
    employee_id: 'EMP001',
    start_latitude: 12.9716,
    start_longitude: 77.5946,
    vehicle_type: 'bike',
    route_name: 'Route A',
    status: 'active'
  })
  .select()
  .single();

if (sessionError) throw sessionError;
```

### Client-Side API Usage (Legacy)
```typescript
// Get shipments with filters
const shipments = await apiClient.get('/api/shipments/fetch', {
  params: {
    status: 'Assigned',
    employeeId: 'EMP001',
    page: 1,
    limit: 20
  }
});

// Update shipment status
await apiClient.patch(`/api/shipments/${shipmentId}`, {
  status: 'Delivered',
  actualDeliveryTime: new Date().toISOString()
});

// Start route session
const session = await apiClient.post('/api/routes/start', {
  employeeId: 'EMP001',
  startLatitude: 12.9716,
  startLongitude: 77.5946,
  vehicleType: 'bike',
  routeName: 'Route A'
});
```

### External System Integration
```typescript
// Receive shipments from external system
const response = await fetch('/api/shipments/receive', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': 'signature'
  },
  body: JSON.stringify({
    shipments: [
      {
        id: 'EXT001',
        status: 'Assigned',
        type: 'delivery',
        customerName: 'John Doe',
        // ... other fields
      }
    ]
  })
});
```

This documentation covers all current API endpoints and provides comprehensive information for developers integrating with the RiderPro system.
