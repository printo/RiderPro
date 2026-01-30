# RiderPro Django Backend Migration

Complete migration guide and status tracking for migrating from Node.js/Express to Django REST Framework backend.

---

## Table of Contents

1. [Overview](#overview)
2. [Current Backend Analysis](#current-backend-analysis)
3. [Django Backend Structure](#django-backend-structure)
4. [Migration Status](#migration-status)
5. [Setup Instructions](#setup-instructions)
6. [Configuration](#configuration)
7. [Authentication System](#authentication-system)
8. [POPS Integration](#pops-integration)
9. [API Endpoints](#api-endpoints)
10. [Next Steps](#next-steps)

---

## Overview

This document tracks the migration from Node.js/Express backend to Django REST Framework backend for RiderPro, with full integration to POPS (Printo Order Processing System).

### Key Requirements

- **Database**: PostgreSQL with separate database name (`riderpro_django`) to avoid conflicts
- **POPS Integration**: Currently read-only, future read/write capability
- **Authentication**: Multi-source (local DB → RiderAccount → POPS API)
- **Rider Types**: 4 types (bike, auto, 3pl, hyperlocal)
- **Rider Approval**: Created from UI → Manager approval → Sync to POPS
- **Token Management**: Same JWT system as POPS (Simple JWT)

---

## Current Backend Analysis

### API Endpoints Structure

#### Authentication (`/api/auth/`)
- `POST /api/auth/login` - POPS API authentication (JWT tokens)
- Returns: `access`, `refresh`, `full_name`, `is_staff`, `is_super_user`, `is_ops_team`, `employee_id`

#### Shipments (`/api/shipments/`)
- `GET /api/shipments/fetch` - List shipments with filters, pagination, role-based access
- `GET /api/shipments/:id` - Get single shipment
- `POST /api/shipments/create` - Create new shipment
- `PATCH /api/shipments/:id` - Update shipment status
- `PATCH /api/shipments/batch` - Batch update shipments
- `POST /api/shipments/:id/remarks` - Add remarks to shipment
- `POST /api/shipments/:id/acknowledgement` - Upload acknowledgment (photo/signature)
- `GET /api/dashboard` - Dashboard metrics

#### Route Tracking (`/api/routes/`)
- `POST /api/routes/start` - Start route session
- `POST /api/routes/stop` - Stop route session
- `POST /api/routes/coordinates` - Submit GPS coordinates
- `POST /api/routes/coordinates/batch` - Batch submit GPS coordinates
- `POST /api/routes/shipment-event` - Record pickup/delivery event
- `GET /api/routes/session/:sessionId` - Get session data
- `POST /api/routes/sync-session` - Sync offline session
- `POST /api/routes/sync-coordinates` - Sync offline coordinates

#### Vehicles (`/api/vehicle-types/`, `/api/fuel-settings/`)
- CRUD operations for vehicle types and fuel settings

#### Sync (`/api/sync/`)
- `GET /api/sync/stats` - Sync statistics
- `POST /api/sync/trigger` - Manual sync trigger
- `GET /api/shipments/sync-status` - Get sync status
- `POST /api/shipments/:id/sync` - Sync single shipment
- `POST /api/shipments/batch-sync` - Batch sync

#### Health (`/health`, `/api/health`, `/api-status`)
- Health check endpoints

### Database Models (Current Node.js Backend)

#### Core Tables
1. **shipments** - Main shipment data with sync tracking
2. **route_sessions** - Route tracking sessions
3. **route_tracking** - GPS coordinates for routes
4. **users** - Authentication and user data
5. **user_sessions** - JWT session management
6. **rider_accounts** - Local rider accounts (for riders without POPS login)
7. **vehicle_types** - Vehicle configuration
8. **fuel_settings** - Fuel pricing
9. **feature_flags** - Feature flag management
10. **system_health_metrics** - System monitoring

### POPS Integration Points

#### Models to Use from POPS
- **Order** (`deliveryq.models.Order`) - Main order/shipment model
- **Route** (`deliveryq.models.Route`) - Route definitions
- **Consignment** (`deliveryq.models.Consignment`) - Consignment data
- **User** (`users.models.User`) - User authentication
- **Riders** - Rider accounts in POPS
- **Area** - Area/region definitions

#### API Endpoints from POPS
- `/api/v1/auth/` - Login (JWT)
- `/api/v1/auth/refresh/` - Refresh token
- `/api/v1/auth/token-verify/` - Verify token
- `/deliveryq/request/delivery/` - Create delivery order
- `/deliveryq/status-update/` - Update order status
- `/deliveryq/consignment/` - Consignment operations
- `/deliveryq/update-route/` - Route updates

---

## Django Backend Structure

### Project Structure
```
backend/
├── manage.py
├── requirements.txt
├── MIGRATION.md              # This file
├── riderpro/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── __init__.py
│   ├── authentication/
│   │   ├── models.py          # User, UserSession, RiderAccount
│   │   ├── views.py           # Login, token refresh
│   │   ├── serializers.py
│   │   ├── backends.py        # Custom auth backend (local + POPS)
│   │   └── urls.py
│   ├── shipments/
│   │   ├── models.py          # Shipment model
│   │   ├── views.py           # Shipment CRUD, dashboard
│   │   ├── serializers.py
│   │   ├── filters.py         # Filtering, pagination
│   │   └── urls.py
│   ├── routes/
│   │   ├── models.py          # RouteSession, RouteTracking
│   │   ├── views.py           # Route tracking endpoints
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── vehicles/
│   │   ├── models.py          # VehicleType, FuelSetting
│   │   ├── views.py           # Vehicle CRUD
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── sync/
│   │   ├── views.py           # Sync endpoints
│   │   ├── services.py        # External sync service
│   │   └── urls.py
│   └── health/
│       ├── views.py           # Health check endpoints
│       └── urls.py
└── utils/
    ├── pops_client.py         # POPS API client
    └── pops_rider_sync.py     # Rider sync service
```

---

## Migration Status

### ✅ Completed

#### 1. Project Structure
- ✅ Django project created (`riderpro/`)
- ✅ All apps created (authentication, shipments, routes, vehicles, sync, health)
- ✅ Settings configured with PostgreSQL database (`riderpro_django`)
- ✅ POPS API client utility created

#### 2. Models Created
- ✅ **User** - Custom user model with multi-source auth support
  - Fields: email, username, employee_id, full_name, role, tokens, auth_source
  - Supports: local, POPS, rider accounts
- ✅ **RiderAccount** - Local rider accounts with 4 types
  - Fields: rider_id, full_name, email, rider_type (bike/auto/3pl/hyperlocal)
  - Approval workflow: is_approved flag, syncs to POPS when approved
- ✅ **UserSession** - JWT session management
- ✅ **Shipment** - Shipment model with POPS integration fields
  - POPS fields: pops_order_id, pops_shipment_uuid
  - Sync tracking: synced_to_external, sync_status, sync_attempts
- ✅ **Acknowledgment** - Acknowledgment records (signature, photo)
- ✅ **RouteSession** - Route tracking sessions
- ✅ **RouteTracking** - GPS coordinates tracking
- ✅ **VehicleType** - Vehicle configuration
- ✅ **FuelSetting** - Fuel pricing settings

#### 3. Authentication System
- ✅ Custom authentication backend (`RiderProAuthBackend`)
  - Flow: Local DB → RiderAccount → POPS API
  - Supports admin users, rider accounts, POPS users
- ✅ Login endpoint (`/api/auth/login`)
  - Returns JWT tokens in same format as POPS
  - Response: access, refresh, full_name, is_staff, is_super_user, is_ops_team, employee_id
- ✅ Token refresh endpoint (`/api/auth/refresh`)
- ✅ JWT token management (Simple JWT, same as POPS)

#### 4. POPS Integration
- ✅ POPS API client (`utils/pops_client.py`)
  - Login, token refresh, token verify
  - Create order, update order status
  - Create consignment, get order
- ✅ Rider sync service (`utils/pops_rider_sync.py`)
  - Syncs approved riders to POPS

### ⏳ In Progress

#### 5. API Viewsets
- ✅ Shipment viewsets (CRUD, dashboard, acknowledgments)
- ✅ Route tracking viewsets
- ✅ Vehicle viewsets
- ✅ Sync viewsets
- ✅ Health check views

#### 6. URL Routing
- ✅ Main URL configuration
- ✅ App-level URL routing (matches Node.js endpoints)

### 📋 Pending

#### 7. POPS Models Integration
- ✅ Receive orders from POPS (webhook endpoint)
- ✅ Live order status updates (webhook endpoint)
- ✅ Location tracking for users (service implemented)
- 📋 Read from POPS tables (routes, consignments, orders, riders, area) - direct DB access
- 📋 Real-time location tracking UI integration

#### 8. Features
- ✅ POPS order receiving service
- ✅ Location tracking service
- ✅ Webhook endpoints for POPS integration
- 📋 Rider approval workflow (manager approval UI)
- 📋 Rider creation from UI
- ✅ Admin user creation (fallback) - via Django admin
- ✅ Order status synchronization - implemented with POPS

---

## Setup Instructions

**⚠️ IMPORTANT: Everything runs inside Docker containers. No local virtual environment needed!**

### Docker Setup (Recommended)
```bash
# Start all services (Django, Frontend, PostgreSQL)
docker compose up --build

# Or with database restore
docker compose --profile db-restore up --build
```

### Local Development (Optional - Not Recommended)
If you need to run Django locally (outside Docker):

1. **Create Virtual Environment**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install Dependencies**
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create `.env` file:
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DB_NAME=riderpro_django
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5433
POPS_API_BASE_URL=http://localhost:8002/api/v1
ALLOWED_HOSTS=localhost,127.0.0.1
```

### 4. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres -h localhost -p 5433

# Create database
CREATE DATABASE riderpro_django;
```

### 5. Run Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser
```bash
python manage.py createsuperuser
```

### 7. Run Development Server
```bash
python manage.py runserver
```

---

## Configuration

### Database
- **Name**: `riderpro_django` (separate from Node.js backend)
- **Host**: `localhost`
- **Port**: `5433`
- **User**: `postgres`
- **Password**: `password`

### POPS API
- **Base URL**: `http://localhost:8002/api/v1`
- **Authentication**: JWT tokens (Simple JWT)
- **Integration**: Currently read-only, future read/write

### Rider Types
1. **bike** - Bike delivery
2. **auto** - Auto/rickshaw delivery
3. **3pl** - Third-party logistics
4. **hyperlocal** - Hyperlocal delivery

### Authentication Sources
1. **local** - Admin users created in RiderPro
2. **pops** - Users authenticated via POPS API
3. **rider** - Local rider accounts (synced to POPS when approved)

---

## Authentication System

### Multi-Source Authentication Flow

1. **Try Local Database First**
   - Check `User` model in local DB
   - Use Django's password verification

2. **Try RiderAccount Database**
   - Check `RiderAccount` model for riders
   - Verify password with bcrypt
   - Create/update User from RiderAccount

3. **Fallback to POPS API**
   - If local auth fails, call POPS `/api/v1/auth/`
   - Get JWT tokens from POPS
   - Create/update local User record
   - Return JWT tokens to client

### Token Management
- Uses Django REST Framework Simple JWT (same as POPS)
- Tokens stored in `UserSession` model
- Support token refresh via POPS API
- Token verification: Try local first, then POPS API

### Rider Approval Workflow
1. Rider created from UI (stored in `RiderAccount`)
2. Manager reviews and approves (`is_approved = True`)
3. Once approved, rider data synced to POPS via `PopsRiderSyncService`
4. Rider can then login (authenticated via RiderAccount)

### Admin User Creation
- Admin users can be created locally via Django admin
- No POPS authentication required
- Stored in local `User` model with `auth_source = 'local'`

---

## POPS Integration

### Current Status
- **Read-only**: Currently reading from POPS
- **Future**: Read and write capability

### Integration Points

#### 1. User Authentication
- Login via POPS API
- Token refresh via POPS API
- User data synced to local DB

#### 2. Orders/Shipments
- Read orders from POPS `Order` model
- Update order status in POPS
- Sync acknowledgments to POPS

#### 3. Routes
- Read routes from POPS `Route` model
- Update route assignments

#### 4. Consignments
- Read consignments from POPS `Consignment` model
- Create consignments in POPS

#### 5. Riders
- Sync approved riders to POPS
- Read rider data from POPS

#### 6. Areas
- Read area/region data from POPS

### POPS API Client
Located in `utils/pops_client.py`:
- `login(email, password)` - Authenticate with POPS
- `refresh_token(refresh_token)` - Refresh access token
- `verify_token(token)` - Verify JWT token
- `create_order(order_data, access_token)` - Create order in POPS
- `update_order_status(order_id, status_data, access_token)` - Update order status
- `create_consignment(consignment_data, access_token)` - Create consignment
- `get_order(order_id, access_token)` - Get order from POPS

### Rider Sync Service
Located in `utils/pops_rider_sync.py`:
- `sync_rider_to_pops(rider, access_token)` - Sync approved rider to POPS

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login (returns JWT tokens)
- `POST /api/auth/refresh` - Refresh token

### Shipments (To be implemented)
- `GET /api/shipments/fetch` - List shipments
- `GET /api/shipments/:id` - Get single shipment
- `POST /api/shipments/create` - Create shipment
- `PATCH /api/shipments/:id` - Update shipment
- `PATCH /api/shipments/batch` - Batch update
- `POST /api/shipments/:id/remarks` - Add remarks
- `POST /api/shipments/:id/acknowledgement` - Upload acknowledgment
- `GET /api/dashboard` - Dashboard metrics

### Routes (To be implemented)
- `POST /api/routes/start` - Start route session
- `POST /api/routes/stop` - Stop route session
- `POST /api/routes/coordinates` - Submit GPS coordinates
- `POST /api/routes/coordinates/batch` - Batch submit coordinates
- `POST /api/routes/shipment-event` - Record shipment event
- `GET /api/routes/session/:sessionId` - Get session data
- `POST /api/routes/sync-session` - Sync offline session
- `POST /api/routes/sync-coordinates` - Sync offline coordinates

### Vehicles (To be implemented)
- `GET /api/vehicle-types` - List vehicle types
- `POST /api/vehicle-types` - Create vehicle type
- `PUT /api/vehicle-types/:id` - Update vehicle type
- `DELETE /api/vehicle-types/:id` - Delete vehicle type
- `GET /api/fuel-settings` - List fuel settings
- `POST /api/fuel-settings` - Create fuel setting
- `PUT /api/fuel-settings/:id` - Update fuel setting
- `DELETE /api/fuel-settings/:id` - Delete fuel setting

### Sync (To be implemented)
- `GET /api/sync/stats` - Sync statistics
- `POST /api/sync/trigger` - Manual sync trigger
- `GET /api/shipments/sync-status` - Get sync status
- `POST /api/shipments/:id/sync` - Sync single shipment
- `POST /api/shipments/batch-sync` - Batch sync

### Health (To be implemented)
- `GET /health` - Health check
- `GET /api/health` - API health check
- `GET /api-status` - API status

---

## Next Steps

### Immediate (Priority 1)
1. ✅ Complete authentication system
2. ⏳ Create shipment viewsets and URLs
3. ⏳ Create route tracking viewsets and URLs
4. ⏳ Create vehicle viewsets and URLs
5. ⏳ Set up main URL routing

### Short-term (Priority 2)
6. 📋 Implement POPS model reading (routes, consignments, orders, riders, area)
7. 📋 Implement live order status updates
8. 📋 Implement location tracking for riders
9. 📋 Test authentication flow end-to-end
10. 📋 Test POPS integration

### Medium-term (Priority 3)
11. 📋 Rider approval workflow UI
12. 📋 Admin user creation UI
13. 📋 Real-time location tracking
14. 📋 Order status synchronization
15. 📋 Data migration (if needed)

### Long-term (Priority 4)
16. 📋 Performance optimization
17. 📋 Caching strategy
18. 📋 Monitoring and logging
19. 📋 Documentation
20. 📋 Deployment configuration

---

## Files Created

### Core Files
- `manage.py` - Django management script
- `requirements.txt` - Python dependencies
- `riderpro/settings.py` - Django settings
- `riderpro/urls.py` - Main URL configuration

### Authentication App
- `apps/authentication/models.py` - User, RiderAccount, UserSession models
- `apps/authentication/views.py` - Login, token refresh views
- `apps/authentication/serializers.py` - User, RiderAccount serializers
- `apps/authentication/backends.py` - Custom authentication backend
- `apps/authentication/urls.py` - Authentication URLs

### Shipments App
- `apps/shipments/models.py` - Shipment, Acknowledgment models

### Routes App
- `apps/routes/models.py` - RouteSession, RouteTracking models

### Vehicles App
- `apps/vehicles/models.py` - VehicleType, FuelSetting models

### Utilities
- `utils/pops_client.py` - POPS API client
- `utils/pops_rider_sync.py` - Rider sync service

---

## Notes

### Database Naming
- Using `riderpro_django` to avoid conflicts with Node.js backend database
- All models use explicit `db_table` to match current schema

### Token Management
- Using Simple JWT (same as POPS) for consistency
- Tokens stored in `UserSession` model for tracking

### Rider Types
- 4 types: bike, auto, 3pl, hyperlocal
- Stored in `RiderAccount.rider_type` field

### POPS Integration
- Currently read-only
- Future: Read and write capability
- Uses POPS API client for all interactions

---

## Questions & Clarifications

If you have questions or need clarifications:
1. Check this document first
2. Review the code comments
3. Check POPS integration points
4. Ask for clarification if needed

---

**Last Updated**: 2026-01-27
**Status**: In Progress (API Viewsets Complete, URL Routing Complete, POPS Integration In Progress)

## Recent Updates

### ✅ Completed (Latest)
1. **API Viewsets** - All viewsets created:
   - ShipmentViewSet with CRUD, batch update, remarks, acknowledgments
   - RouteSessionViewSet with start/stop, coordinates, shipment events
   - VehicleTypeViewSet and FuelSettingViewSet
   - SyncViewSet with stats, trigger, batch sync
   - DashboardViewSet with metrics
   - Health check endpoints

2. **URL Routing** - All URLs configured to match Node.js backend:
   - `/api/auth/*` - Authentication
   - `/api/shipments/*` - Shipments (fetch, create, batch, remarks, acknowledgement)
   - `/api/routes/*` - Route tracking (start, stop, coordinates, session, sync)
   - `/api/vehicle-types/*` - Vehicle types
   - `/api/fuel-settings/*` - Fuel settings
   - `/api/sync/*` - Sync operations
   - `/health`, `/api/health`, `/api-status` - Health checks

3. **POPS Order Receiving**:
   - `PopsOrderReceiver` service to receive orders from POPS
   - Webhook endpoint `/api/shipments/webhooks/receive-order`
   - Automatically creates shipments when orders assigned to riders
   - Maps POPS Order model to RiderPro Shipment model

4. **Live Order Status Updates**:
   - Webhook endpoint `/api/shipments/webhooks/order-status`
   - Updates shipment status when changed in POPS
   - Status mapping between POPS and RiderPro

5. **Location Tracking**:
   - `LocationTrackingService` for real-time location tracking
   - Endpoints: `/api/routes/track-location`, `/api/routes/current-location`, `/api/routes/active-riders`
   - Auto-creates route sessions for location tracking
   - Tracks GPS coordinates with accuracy and speed

