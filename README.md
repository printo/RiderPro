# RiderPro - Delivery Management System

Complete PostgreSQL-based logistics platform with real-time GPS tracking, route optimization, role-based access control, and **bidirectional integration system** for external systems.

## 📋 Table of Contents

1. [Quick Start](#-quick-start)
2. [Prerequisites](#-prerequisites)
3. [Database](#️-database-postgresql-15)
4. [Authentication & Roles](#-authentication--roles)
5. [Bidirectional Integration System](#-bidirectional-integration-system)
6. [Key Features](#-key-features)
7. [Development Commands](#️-development-commands)
8. [Deployment](#-deployment-e2enetwork--situationcommand)
9. [Project Structure](#-project-structure)
10. [Data Flow](#-data-flow)
11. [Technology Stack](#-technology-stack)
12. [Environment Variables](#️-environment-variables)
13. [Troubleshooting](#-troubleshooting)
14. [Documentation](#-documentation)

## 🚀 Quick Start

```bash
# One command to start everything (PostgreSQL + app with hot reload)
npm run dev

# Access the application
# Dashboard: http://localhost:5000
# Health Check: http://localhost:5000/health
```

**That's it!** Docker will automatically:

- ✅ Start PostgreSQL main database (port 5432)
- ✅ Start PostgreSQL backup database (port 5433) - dev only
- ✅ Initialize all tables and indexes
- ✅ Start app with hot reload on code changes

## 📋 Prerequisites

- Node.js >= 18.0.0
- Docker & Docker Compose

## 🗄️ Database (PostgreSQL 15)

### **Migration Complete: SQLite → PostgreSQL**

- **Status**: ✅ Production ready
- **Performance**: 20-100x faster queries
- **Features**: Connection pooling, auto-sync backup (dev), optimized indexes

### Tables

```
shipments          - External shipment data (unique: id)
route_sessions     - Route tracking sessions
route_tracking     - GPS coordinates
users              - Authentication
vehicle_types      - Vehicle configurations
fuel_settings      - Fuel pricing
```

See [DATABASE.md](./DATABASE.md) for schema details.

## 🔑 Authentication & Roles

### Dual System

1. **External API** (Printo) - Enterprise users
2. **Local Database** - Self-hosted with approval workflow

### Roles & Access

- **Super User**: Full access (all data + system config)
- **Ops Team/Staff**: All shipments, all routes, all metrics
- **Riders/Drivers**: Own shipments only, own routes only

## 🔄 Bidirectional Integration System

RiderPro provides a complete **bidirectional integration system** with clean architecture that allows external systems to:

1. **Send shipments** to RiderPro via batch webhook endpoints
2. **Receive real-time updates** when shipment statuses change
3. **Track data sources** with full audit trails
4. **Manage integrations** through comprehensive APIs

### 🔧 Configuration

Configure your integrations in `backend/riderpro/localsettings.py`:

```python
# API Keys for webhook authentication (Enhanced format with callback URLs)
RIDER_PRO_API_KEYS = {
    "pia_api_key": {
        "key": "your-api-key",
        "callback_url": "https://pia.example.com/api/callback",
        "active": True,
        "auth_header": "Bearer your-auth-token"  # Optional
    },
    "external_system_key_1": {
        "key": "your-api-key-2",
        "callback_url": "https://ext1.example.com/webhook",
        "active": True
    }
}
```

**Configuration Fields:**
- `key`: API key for authentication (required)
- `callback_url`: URL where RiderPro sends status updates (required)
- `active`: Whether this integration is active (required)
- `auth_header`: Optional authentication header for callbacks

### 📥 Inbound Integration (Receiving Shipments)

#### Authentication
All webhook endpoints support dual authentication:
- **API Key**: Include `x-api-key` header with your API key
- **JWT Token**: Include `Authorization: Bearer <token>` header
- **Optional**: `X-Service-Name` header for service identification

#### Main Endpoint: `/api/v1/shipments/receive`

**Method**: POST  
**Supports**: Both single order and batch shipments formats

**Batch Shipments Format (Recommended):**
```json
{
  "shipments": [
    {
      "id": "12345",
      "type": "delivery",
      "status": "Assigned",
      "deliveryAddress": "123 Main St, Bangalore, KA 560001, India",
      "recipientName": "John Doe",
      "recipientPhone": "9876543210",
      "estimatedDeliveryTime": "2023-10-27T10:00:00+00:00",
      "cost": 150.0,
      "routeName": "Route A",
      "employeeId": "EMP001",
      "pickupAddress": "..." // Optional for pickup orders
    }
  ]
}
```

#### Response Formats

**Success Response:**
```json
{
  "success": true,
  "message": "All 2 shipments processed successfully",
  "total_shipments": 2,
  "processed": 2,
  "failed": 0,
  "shipment_ids": ["12345", "12346"],
  "errors": []
}
```

### 📤 Outbound Integration (Sending Updates)

#### Automatic Callbacks
RiderPro automatically sends callbacks when:
- **Shipment Created**: New shipment received from external system
- **Status Changed**: Shipment status updated (Assigned → In Transit → Delivered)
- **Delivery Confirmed**: Special callback for delivery/pickup completion

#### Callback Payload Format
```json
{
  "event": "status_update",
  "timestamp": "2023-10-27T14:30:00+00:00",
  "shipment": {
    "id": "12345",
    "status": "Delivered",
    "type": "delivery",
    "customer_name": "John Doe",
    "customer_mobile": "9876543210",
    "address": "123 Main St, Bangalore, KA 560001, India",
    "employee_id": "EMP001",
    "route_name": "Route A",
    "delivery_time": "2023-10-27T10:00:00+00:00",
    "actual_delivery_time": "2023-10-27T14:25:00+00:00",
    "cost": 150.0,
    "latitude": 12.9716,
    "longitude": 77.5946,
    "km_travelled": 15.5,
    "remarks": "Delivered successfully",
    "signature_url": "https://riderpro.printo.in/media/signatures/12345.png",
    "photo_url": "https://riderpro.printo.in/media/photos/12345.jpg"
  }
}
```

### 🧪 Testing Integration

#### Using cURL
```bash
curl -X POST https://riderpro.printo.in/api/v1/shipments/receive \
  -H "Content-Type: application/json" \
  -H "x-api-key: django-pia$z9@4u%6c!3p7y^2l0q*e_1r8h-k(m)=w#s&" \
  -H "X-Service-Name: pops" \
  -d '{
    "shipments": [
      {
        "id": "TEST001",
        "type": "delivery",
        "status": "Assigned",
        "deliveryAddress": "123 Test Street, Bangalore, KA 560001, India",
        "recipientName": "John Test Doe",
        "recipientPhone": "9876543210",
        "estimatedDeliveryTime": "2024-12-31T10:00:00+00:00",
        "cost": 150.0,
        "routeName": "Test Route A",
        "employeeId": "TEST_EMP001"
      }
    ]
  }'
```

#### Management APIs
- **Test Callback**: `POST /api/v1/callbacks/test`
- **Manual Callback**: `POST /api/v1/callbacks/send`
- **Analytics**: `GET /api/v1/analytics/api-sources`

### 🚀 Production Deployment

#### Required Steps:
1. **Database Migration**:
   ```bash
   python3 manage.py makemigrations shipments --name add_api_source_tracking
   python3 manage.py migrate
   ```

2. **Update Configuration**: Replace example URLs with real callback URLs in `localsettings.py`

3. **Restart Django**: `sudo systemctl restart riderpro-django` or equivalent

#### Benefits After Deployment:
- ✅ **Real-time Updates**: Instant status change notifications
- ✅ **Complete Integration**: External systems stay synchronized
- ✅ **Full Audit Trail**: Track which system sent each shipment
- ✅ **Scalable Architecture**: Easy to add new integrations
- ✅ **Clean Codebase**: No legacy baggage, easier maintenance

## 📊 Key Features

### Core

- **Bidirectional Integration**: Send/receive shipments with external systems
- **Real-time Callbacks**: Automatic status updates to external systems
- Real-time shipment tracking with GPS
- Smart route optimization
- Digital acknowledgments (photo + signature)
- Batch operations
- Advanced analytics
- Offline sync

### Technical

- **API Source Tracking**: Every shipment knows its origin
- **Clean Architecture**: No legacy support, secure by design
- **Multiple Integrations**: Support for multiple external systems
- Role-based data filtering (query-level)
- Automatic duplicate prevention (shipment ID uniqueness)
- 3-day backup rotation (dev/alpha only)
- Health monitoring with caching
- Migration management

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start with Docker (hot reload)
npm run dev:local        # Start without Docker

# Database
npm run db:init          # Initialize database
npm run db:migrate       # Run migrations
npm run db:verify        # Verify PostgreSQL setup

# Production
npm run build            # Build for production
npm start                # Start production server

# Testing
npm run check            # TypeScript check
npm run lint             # Lint code
```

## 🚀 Deployment (e2enetwork / SituationCommand)

### Deploy new code (Standard Procedure)

Use this command after `git pull` to rebuild the container with the latest code.

```bash
docker compose up -d --build
```

_Note: The `--build` flag is critical to ensure the new code is compiled._

### Restart services

Use this if the server is acting up but code hasn't changed.

```bash
docker compose restart
```

### Reboot server

Use this if the server was completely stopped or rebooted.

```bash
docker compose up -d
```

### 🔥 Nuclear reset

```bash
docker compose down --volumes  # ONLY if you accept data loss
```

## 📁 Project Structure

```
RiderPro/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom hooks
│   │   └── services/    # Business logic
├── server/              # Express backend
│   ├── db/             # Database layer
│   ├── routes/         # API endpoints
│   └── middleware/     # Auth & security
├── shared/             # Shared types
└── docker-compose.yml  # Docker configuration
```

## 🔄 Data Flow

### External → Database (Bidirectional Integration)

```
External System → API Key Auth → Batch Processing → PostgreSQL (main)
                                                   ↓
                       [Dev/Alpha] PostgreSQL (backup, last 3 days)
```

### Rider Updates → External (Real-time Callbacks)

```
Rider App → PostgreSQL → Django Signals → Automatic Callbacks → External Systems
```

### Legacy: Printo API → Database

```
Printo API → Webhook → Validation → PostgreSQL (main)
                                   ↓
                       [Dev/Alpha] PostgreSQL (backup, last 3 days)
```

### UI Data Access (Role-Based)

```
User Login → Role Check → Filter queries by employeeId (riders) or all data (admin/ops)
```

## 🎯 Technology Stack

**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query\
**Backend**: Node.js, Express, TypeScript\
**Database**: PostgreSQL 15 with connection pooling\
**Infrastructure**: Docker, Docker Compose

## ⚙️ Environment Variables

```bash
# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/riderpro
BACKUP_DATABASE_URL=postgres://postgres:password@localhost:5433/riderpro_backup

# Server
NODE_ENV=development
DEPLOYMENT_ENV=localhost
PORT=5000

# Security
JWT_SECRET=your-secret-key-32-chars-min
```

## 🆘 Troubleshooting

### "Connection refused"

```bash
docker compose ps          # Check if PostgreSQL is running
docker compose restart postgres
```

### "Tables not found"

```bash
npm run db:init           # Manual initialization
```

### Check health

```bash
curl http://localhost:5000/health
```

## 📖 Documentation

- **Integration Guide** - Complete bidirectional integration documentation (this README)
- **DATABASE.md** - Database schema and queries
- **Code comments** - Inline documentation in source files

### Integration Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/shipments/receive` | POST | Main webhook for receiving shipments |
| `/api/v1/webhooks/receive-shipments-batch` | POST | Dedicated batch processing |
| `/api/v1/callbacks/test` | POST | Test callback URLs |
| `/api/v1/callbacks/send` | POST | Manual callback trigger |
| `/api/v1/analytics/api-sources` | GET | Integration analytics |

## 📄 License

MIT License - see LICENSE file

---

**Version**: PostgreSQL Migration + Bidirectional Integration Complete\
**Date**: February 2026\
**Status**: ✅ Production Ready with Clean Architecture Integration System
