# RiderPro Shipment Management System

## Overview

RiderPro is a comprehensive shipment management system designed for logistics
and delivery operations. The application provides a real-time dashboard for
tracking shipments, managing deliveries and pickups, and handling
acknowledgments with digital signatures and photos. Built as a full-stack
application with real-time updates and mobile-responsive design, it serves both
operational staff and field workers managing shipment lifecycles.

## Documentation

See `docs/README.md` for detailed product and technical documentation (auth,
roles, and feature guides).

## Technology Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and CSS variables for
  theming
- **State Management**: TanStack Query (React Query) for server state management
  with automatic caching and real-time updates
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form
  management
- **Error Handling**: React Error Boundaries with graceful fallback UI and error
  logging

### Backend

- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: SQLite with Better SQLite3 for local storage, dual database
  setup (live + replica)
- **ORM**: Drizzle ORM with PostgreSQL dialect configuration (ready for
  migration)
- **File Handling**: Multer for multipart file uploads (signatures and photos)
- **Scheduling**: Node-cron for automated database maintenance tasks
- **External Sync**: Axios with retry logic and exponential backoff for API
  integrations
- **API Design**: RESTful API with structured error handling and request logging

### Data Storage

- **Primary Database**: SQLite with two instances - live database for active
  operations and replica database for data persistence
- **File Storage**: Local file system with organized directory structure for
  uploaded signatures and photos
- **Database Schema**: Normalized schema with shipments, acknowledgments, and
  sync_status tables
- **Data Lifecycle**: Automated daily reset of live database while maintaining
  historical data in replica

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

### Application Pages

**Public Pages (All Users):**

- Dashboard: `http://localhost:5000/`
- Shipments: `http://localhost:5000/shipments`
- Route Analytics: `http://localhost:5000/route-analytics`
- Route Visualization: `http://localhost:5000/route-visualization`

**Admin Pages (Admin Users Only):**

- Admin Dashboard: `http://localhost:5000/admin`

### Authentication

Uses Printo API token authentication:

- Login via `/api/auth/login` proxied to `https://pia.printo.in/api/v1/auth/`
- Stores `access_token`, `refresh_token`, user with role-based permissions
- Sends `Authorization: Bearer <access-token>` for API requests
- Auto-refresh via `/api/auth/refresh` on 401
- **Super Admin Override:** `kanna.p@printo.in` and employee ID `12180` get
  super admin access regardless of API role

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

All data endpoints require authentication. Include the access token in the
Authorization header:

```
Authorization: Bearer <access-token>
```

#### 1. Dashboard Metrics

**GET** `/api/dashboard`

**Response:**

```json
{
  "totalShipments": 150,
  "completed": 120,
  "inProgress": 25,
  "pending": 5,
  "statusBreakdown": {
    "Assigned": 15,
    "In Transit": 10,
    "Delivered": 100,
    "Picked Up": 20,
    "Returned": 3,
    "Cancelled": 2
  },
  "typeBreakdown": {
    "delivery": 90,
    "pickup": 60
  },
  "routeBreakdown": {
    "Route A": {
      "total": 50,
      "delivered": 40,
      "pickedUp": 5,
      "pending": 3,
      "cancelled": 2,
      "pickupPending": 1,
      "deliveryPending": 2
    }
  }
}
```

#### 2. Shipment Management

**GET** `/api/shipments`

Query Parameters:

- `status`: Filter by status (optional)
- `type`: Filter by type ('delivery' or 'pickup') (optional)
- `routeName`: Filter by route (optional)
- `date`: Filter by delivery date (optional)

**Response:**

```json
[
  {
    "id": "unique-shipment-id",
    "type": "delivery",
    "customerName": "John Doe",
    "customerMobile": "+91-9876543210",
    "address": "123 Main Street, City, State",
    "cost": 500.00,
    "deliveryTime": "2025-08-28T15:00:00Z",
    "routeName": "Route A",
    "employeeId": "EMP123",
    "status": "Assigned",
    "createdAt": "2025-08-28T10:00:00Z",
    "updatedAt": "2025-08-28T10:00:00Z"
  }
]
```

**POST** `/api/shipments`

**Request Body:**

```json
{
  "id": "optional-custom-id",
  "type": "delivery",
  "customerName": "John Doe",
  "customerMobile": "+91-9876543210",
  "address": "123 Main Street, City, State",
  "cost": 500.00,
  "deliveryTime": "2025-08-28T15:00:00Z",
  "routeName": "Route A",
  "employeeId": "EMP123",
  "status": "Assigned"
}
```

**Response:** Same as GET single shipment

#### 3. Shipment Status Updates

**PATCH** `/api/shipments/:id`

**Request Body:**

```json
{
  "status": "Delivered"
}
```

**Response:** Updated shipment object

**PATCH** `/api/shipments/batch`

**Request Body:**

```json
{
  "updates": [
    {
      "id": "shipment-id-1",
      "status": "Delivered"
    },
    {
      "id": "shipment-id-2",
      "status": "In Transit"
    }
  ]
}
```

**Response:**

```json
{
  "updatedCount": 2,
  "message": "2 shipments updated successfully"
}
```

#### 4. Acknowledgment Upload

**POST** `/api/shipments/:id/acknowledgement`

**Content-Type:** `multipart/form-data`

**Form Fields:**

- `photo`: Image file (optional)
- `signature`: Signature image file (optional)
- `signatureData`: Base64 signature data (optional, alternative to signature
  file)

**Response:**

```json
{
  "id": "acknowledgment-id",
  "shipmentId": "shipment-id",
  "signatureUrl": "/uploads/signatures/filename.png",
  "photoUrl": "/uploads/photos/filename.jpg",
  "capturedAt": "2025-08-28T15:30:00Z"
}
```

#### 5. Remarks Collection

**POST** `/api/shipments/:id/remarks`

**Request Body:**

```json
{
  "remarks": "Customer requested cancellation due to address change",
  "status": "Cancelled"
}
```

**Response:**

```json
{
  "shipmentId": "shipment-id",
  "remarks": "Customer requested cancellation due to address change",
  "status": "Cancelled",
  "savedAt": "2025-08-28T15:30:00Z"
}
```

#### 6. External Sync Status

**GET** `/api/sync/stats`

**Response:**

```json
{
  "totalPending": 5,
  "totalSent": 145,
  "totalFailed": 2,
  "lastSyncTime": "2025-08-28T15:30:00Z"
}
```

**POST** `/api/sync/trigger`

**Response:**

```json
{
  "processed": 5,
  "success": 4,
  "failed": 1
}
```

## Environment Configuration

### Development vs Production

**Development Mode (npm run dev):**

- Uses replica database for primary operations
- Live database serves as backup/secondary
- Detailed logging enabled
- Hot reloading for frontend and backend

**Production Mode:**

- Uses live database for primary operations
- Replica database serves as backup/historical data
- Optimized logging
- Compiled assets served efficiently

### Environment Variables

```bash
# Database Configuration
NODE_ENV=development|production
DATABASE_PATH=./data/riderpro.db

# Authentication Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# External Authentication API
EXTERNAL_AUTH_API_URL=https://your-auth-api.com/authenticate
EXTERNAL_AUTH_API_KEY=your-api-key-here

# External API Integration (Data Sync)
EXTERNAL_API_URL=https://api.external-service.com
EXTERNAL_API_KEY=your_api_key

# File Upload Configuration
UPLOAD_DIR=./server/uploads
MAX_FILE_SIZE=5242880  # 5MB

# Sync Configuration
SYNC_RETRY_ATTEMPTS=3
SYNC_RETRY_DELAY=1000  # milliseconds
```

## External API Integration

### Authentication API Integration

The system integrates with your existing authentication API for user login. Your
external API should accept POST requests with the following format:

**Authentication Endpoint:** `EXTERNAL_AUTH_API_URL` (configured in environment)

**Request Format:**

```json
{
  "username": "user@company.com",
  "password": "userpassword"
}
```

**Expected Response Format:**

```json
{
  "success": true,
  "user": {
    "id": "employee123",
    "username": "user@company.com",
    "email": "user@company.com",
    "role": "employee", // or "manager", "admin", "driver", "viewer"
    "employeeId": "employee123"
  }
}
```

**Error Response Format:**

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Supported Roles:**

- `admin`: Full system access including user management and system configuration
- `manager`: Access to all routes, analytics, data export, and live tracking
- `driver`: Access to own routes only
- `viewer`: Read-only access to analytics

### Data Sync Integration

### Outgoing Sync Format

The system automatically syncs shipment updates to external APIs with the
following payload structure:

```json
{
  "shipment": {
    "id": "shipment-id",
    "type": "delivery",
    "customerName": "John Doe",
    "customerMobile": "+91-9876543210",
    "address": "123 Main Street, City, State",
    "cost": 500.00,
    "deliveryTime": "2025-08-28T15:00:00Z",
    "routeName": "Route A",
    "employeeId": "EMP123",
    "status": "Delivered",
    "updatedAt": "2025-08-28T15:30:00Z"
  },
  "acknowledgment": {
    "signatureUrl": "https://your-domain.com/uploads/signatures/file.png",
    "photoUrl": "https://your-domain.com/uploads/photos/file.jpg",
    "capturedAt": "2025-08-28T15:30:00Z"
  },
  "metadata": {
    "syncedAt": "2025-08-28T15:31:00Z",
    "source": "riderpro-app",
    "version": "1.0.0"
  }
}
```

### Incoming Webhook Format

To receive new shipments from external systems, send POST requests to
`/api/shipments`:

```json
{
  "id": "external-system-id",
  "type": "delivery",
  "customerName": "John Doe",
  "customerMobile": "+91-9876543210",
  "address": "123 Main Street, City, State",
  "cost": 500.00,
  "deliveryTime": "2025-08-28T15:00:00Z",
  "routeName": "Route A",
  "employeeId": "EMP123"
}
```

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd riderpro-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   ```bash
   # Required: External authentication API
   EXTERNAL_AUTH_API_URL=https://your-auth-api.com/authenticate
   EXTERNAL_AUTH_API_KEY=your-api-key-here

   # Required: JWT secret for session management
   JWT_SECRET=your-super-secret-jwt-key-change-in-production

   # Optional: Other configuration options
   DATABASE_PATH=./data/riderpro.db
   PORT=3001
   ```

4. **Initialize database**
   ```bash
   npm run migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:5000/api
   - Admin Dashboard: http://localhost:5000/admin (Admin users only)
   - Route Analytics: http://localhost:5000/route-analytics (All users)
   - Route Visualization: http://localhost:5000/route-visualization (All users)
   - Login with credentials from your Printo authentication system

### Development Scripts

```bash
# Start development server (frontend + backend)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run database migrations
npm run db:migrate

# Generate database schema
npm run db:generate

# Install new packages
npm install <package-name>
```

## Key Features

### 1. Real-time Dashboard

- Live shipment metrics and status breakdown
- Route performance analytics with visual progress bars
- External sync status monitoring with manual trigger option
- Auto-refreshing data every 30 seconds

### 2. Shipment Management

- Complete CRUD operations for shipments
- Advanced filtering by status, type, route, and date
- Batch operations for bulk status updates
- Mobile-optimized card-based interface

### 3. Status Workflow Management

- **Delivered/Picked Up**: Requires photo + digital signature
- **Cancelled/Returned**: Requires mandatory remarks collection
- **In Transit/Assigned**: Simple status updates
- Real-time status change notifications

### 4. Digital Acknowledgments

- Canvas-based digital signature capture
- Camera integration for delivery photos
- Secure file storage with organized directory structure
- Base64 and file upload support for signatures

### 5. Mobile-First Design

- Responsive design optimized for mobile devices
- Touch-friendly interface elements
- Floating action menu for easy navigation
- Swipe-friendly card interactions

### 6. External API Synchronization

- Automatic sync with retry logic and exponential backoff
- Manual sync trigger for pending shipments
- Comprehensive error handling and status tracking
- Configurable sync endpoints and authentication

### 7. Error Handling & Monitoring

- React Error Boundaries with graceful fallback UI
- Comprehensive error logging to external services
- Toast notifications for user feedback
- API error tracking and debugging support

## Production Deployment

### Build Process

```bash
# Build optimized production assets
npm run build

# Verify build integrity
npm run preview
```

### Database Migration

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database URL
3. Set up external API credentials
4. Configure file upload directory with proper permissions
5. Set up reverse proxy (nginx/Apache) if needed

### Security Considerations

#### Authentication Security

- **JWT Tokens**: Use strong, unique JWT secrets (32+ characters minimum)
- **External API Security**: Ensure your external authentication API uses HTTPS
  and proper authentication
- **Session Management**: JWT tokens expire after configured time (default 24h)
- **Rate Limiting**: Login attempts are rate-limited (5 attempts per 15 minutes
  per IP)
- **Role-Based Access**: Endpoints are protected based on user roles and
  permissions

#### General Security

- Use HTTPS in production
- Sanitize file uploads and validate file types
- Implement rate limiting for API endpoints
- Set up proper CORS policies
- Use environment variables for sensitive configuration
- Secure database file permissions (SQLite)
- Regular security audits of dependencies

## Troubleshooting

### Common Issues

1. **Authentication Issues**
   - Verify `EXTERNAL_AUTH_API_URL` is accessible and returns expected format
   - Check `EXTERNAL_AUTH_API_KEY` is valid and has proper permissions
   - Ensure `JWT_SECRET` is set and sufficiently complex
   - Verify external API returns user data in the expected format
   - Check network connectivity to external authentication API

2. **Database Connection Errors**
   - Verify database file permissions
   - Check disk space availability
   - Ensure proper SQLite version
   - Run `npm run migrate` to initialize database

3. **File Upload Issues**
   - Verify upload directory permissions
   - Check file size limits
   - Validate file type restrictions

4. **External Sync Failures**
   - Check network connectivity
   - Verify API credentials
   - Review sync error logs

5. **Performance Issues**
   - Monitor database query performance
   - Check memory usage during file uploads
   - Review network latency for API calls

### Debugging Tips

1. **Enable Detailed Logging**
   ```bash
   DEBUG=riderpro:* npm run dev
   ```

2. **Database Inspection**
   ```bash
   sqlite3 server/db/sqlite.db
   .tables
   .schema shipments
   ```

3. **API Testing**
   ```bash
   # Test authentication
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test@company.com","password":"password"}'

   # Test authenticated endpoints (replace TOKEN with actual JWT)
   curl -X GET http://localhost:3001/api/dashboard \
     -H "Authorization: Bearer TOKEN"

   curl -X POST http://localhost:3001/api/shipments \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{...}'
   ```

## Contributing

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Write descriptive commit messages

### Testing Guidelines

- Add data-testid attributes for UI components
- Test API endpoints with various input scenarios
- Verify error handling paths
- Test mobile responsiveness

### Pull Request Process

1. Create feature branch from main
2. Implement changes with proper testing
3. Update documentation if needed
4. Submit pull request with detailed description
5. Address code review feedback

## License

This project is proprietary software developed for logistics operations. All
rights reserved.

## Support

For technical support or questions:

- Create an issue in the project repository
- Contact the development team
- Review the troubleshooting section above

---

**Last Updated**: August 28, 2025 **Version**: 1.0.0 **Maintainer**: Development
Team
