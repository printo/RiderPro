# Documentation

This folder contains product and technical documentation for RiderPro. Below is the full system overview and API docs. See also:
- smart-route-completion.md

# RiderPro Shipment Management System

## Overview

RiderPro is a comprehensive shipment management system designed for logistics and delivery operations. The application provides a real-time dashboard for tracking shipments, managing deliveries and pickups, and handling acknowledgments with digital signatures and photos. Built as a full-stack application with real-time updates and mobile-responsive design, it serves both operational staff and field workers managing shipment lifecycles.

## Authentication & Roles

- Django token-based login proxied via `/api/auth/login`
- Stored tokens: access_token, refresh_token
- Cookies mirrored: access, refresh, full_name, is_ops_team
- Literal roles used from Django: admin, isops, isdelivery, user
- Admin UI:
  - admin: full edit access
  - isops: view-only, no edits
  - isdelivery: no access to Admin (link hidden, route guarded)
- /admin redirects to /dashboard if role is not admin or isops.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management with automatic caching and real-time updates
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Error Handling**: React Error Boundaries with graceful fallback UI and error logging

### Backend
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: SQLite with Better SQLite3 for local storage, dual database setup (live + replica)
- **ORM**: Drizzle ORM with PostgreSQL dialect configuration (ready for migration)
- **File Handling**: Multer for multipart file uploads (signatures and photos)
- **Scheduling**: Node-cron for automated database maintenance tasks
- **External Sync**: Axios with retry logic and exponential backoff for API integrations
- **API Design**: RESTful API with structured error handling and request logging

### Data Storage
- **Primary Database**: SQLite with two instances - live database for active operations and replica database for data persistence
- **File Storage**: Local file system with organized directory structure for uploaded signatures and photos
- **Database Schema**: Normalized schema with shipments, acknowledgments, and sync_status tables
- **Data Lifecycle**: Automated daily reset of live database while maintaining historical data in replica

## Project Structure

```
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Shadcn/ui base components
│   │   │   ├── ErrorBoundary.tsx      # Error handling wrapper
│   │   │   ├── FloatingActionMenu.tsx # Mobile navigation menu
│   │   │   ├── Navigation.tsx         # Top navigation bar
│   │   │   ├── ShipmentCard.tsx       # Shipment list item component
│   │   │   ├── ShipmentDetailModal.tsx # Shipment details and actions
│   │   │   ├── RemarksModal.tsx       # Remarks collection for cancelled/returned
│   │   │   ├── SyncStatusPanel.tsx    # External sync monitoring
│   │   │   ├── SignatureCanvas.tsx    # Digital signature capture
│   │   │   ├── BatchUpdateModal.tsx   # Bulk operations interface
│   │   │   └── Filters.tsx           # Shipment filtering controls
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.tsx          # Real-time metrics and overview
│   │   │   ├── Shipments.tsx          # Shipment list and management
│   │   │   └── not-found.tsx          # 404 page
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useDashboard.ts        # Dashboard data fetching
│   │   │   ├── useShipments.ts        # Shipment data management
│   │   │   └── use-toast.ts           # Toast notification system
│   │   ├── lib/               # Utility libraries
│   │   │   ├── queryClient.ts         # TanStack Query configuration
│   │   │   └── utils.ts               # General utility functions
│   │   ├── App.tsx            # Main application component
│   │   └── index.css          # Global styles and Tailwind configuration
├── server/                     # Backend Node.js application
│   ├── api/                   # API route organization
│   │   └── index.ts           # API structure documentation
│   ├── db/                    # Database layer
│   │   ├── connection.ts      # Database connection and initialization
│   │   ├── queries.ts         # Database query operations
│   │   ├── sqlite.db          # Live database (production)
│   │   └── replica_sqlite.db  # Replica database (development)
│   ├── services/              # Business logic services
│   │   ├── externalSync.ts    # External API synchronization
│   │   └── scheduler.ts       # Automated task scheduling
│   ├── uploads/               # File storage directory
│   │   ├── signatures/        # Digital signature files
│   │   └── photos/           # Delivery photo files
│   ├── routes.ts              # Express route definitions
│   ├── storage.ts             # Data access layer interface
│   ├── index.ts               # Server entry point
│   └── vite.ts                # Vite development server integration
├── shared/                     # Shared TypeScript schemas
│   ├── schema.ts              # Zod schemas for data validation
│   └── syncStatus.ts          # Sync operation type definitions
├── package.json               # Project dependencies and scripts
├── vite.config.ts             # Vite build configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── drizzle.config.ts          # Database migration configuration
└── tsconfig.json              # TypeScript configuration
```

## Database Schema

### Shipments Table
```sql
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('delivery', 'pickup')),
  customerName TEXT NOT NULL,
  customerMobile TEXT NOT NULL,
  address TEXT NOT NULL,
  cost REAL NOT NULL,
  deliveryTime TEXT NOT NULL,
  routeName TEXT NOT NULL,
  employeeId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Assigned' CHECK(status IN ('Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled')),
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
```

### Acknowledgments Table
```sql
CREATE TABLE acknowledgments (
  id TEXT PRIMARY KEY,
  shipmentId TEXT NOT NULL,
  signatureUrl TEXT,
  photoUrl TEXT,
  capturedAt TEXT NOT NULL,
  FOREIGN KEY (shipmentId) REFERENCES shipments (id)
);
```

### Sync Status Table
```sql
CREATE TABLE sync_status (
  id TEXT PRIMARY KEY,
  shipmentId TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')),
  attempts INTEGER DEFAULT 0,
  lastAttempt TEXT,
  error TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (shipmentId) REFERENCES shipments (id)
);
```

## API Documentation

### Base URL
- Development: `http://localhost:5000/api`
- Production: `https://your-domain.com/api`

### Authentication
Uses Django-issued token authentication (no JWT required):
- Login proxied via `/api/auth/login` to `https://pia.printo.in/api/v1/auth/`
- Stores `access_token`, `refresh_token`, user with literal role (`admin`, `isops`, `isdelivery`)
- Sends `Authorization: Bearer <access-token>` and cookies
- Auto-refresh via `/api/auth/refresh` on 401

### Authentication Endpoints

#### Login
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
      "role": "isops",
      "employeeId": "employee123",
      "fullName": "User Name",
      "permissions": ["view_all_routes"]
    }
  }
}
```

#### Get Current User
**GET** `/api/auth/me`

**Headers:**
```
Authorization: Bearer <access-token>
```

#### Logout
**POST** `/api/auth/logout`

**Headers:**
```
Authorization: Bearer <access-token>
```

### Data Endpoints

All data endpoints require authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access-token>
```
