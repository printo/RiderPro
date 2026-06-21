# RiderPro - Delivery Management System

Complete PostgreSQL-based logistics platform with real-time GPS tracking, route
optimization, role-based access control, and **bidirectional integration
system** for external systems.

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
13. [Cron Jobs & Database Maintenance](#-cron-jobs--database-maintenance)
14. [Troubleshooting](#-troubleshooting)

## 🚀 Quick Start

```bash
# Full stack (Django + Vite + Postgres) with hot reload — no localsettings.py needed
docker compose up --build

# Access the application
# Frontend:     http://localhost:5004
# Health check: http://localhost:5004/api/v1/health
```

**That's it!** Docker will automatically:

- ✅ Start PostgreSQL (host port 5433)
- ✅ Run migrations and initialize tables/indexes
- ✅ Start Django (host port 8004) + the Vite frontend (port 5004) with hot reload

> `npm run dev` runs the **Vite frontend only** (port 5004) — it does *not* start Docker/Postgres/Django. Use it only when the backend is already running.

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
shipments               - External shipment data (main table)
route_sessions          - Route tracking sessions
route_tracking          - GPS coordinates
users                   - Authentication (Django User model)
rider_accounts          - Local riders (phone, vehicle_type, is_approved, archived_at)
otp_challenges          - Hashed rider-login OTP codes (TTL + attempt tracking)
homebases               - Rider homebases (synced from POPS)
vehicle_change_requests - Admin-approved rider vehicle changes
vehicle_types           - Vehicle configurations (mileage)
fuel_settings           - Fuel pricing
```

## 🔑 Authentication & Roles

### Login paths

1. **Riders — phone + OTP (passwordless).** Enter a registered phone, receive a 6-digit code over **WhatsApp** (Botspace), verify it to log in. `POST /api/v1/auth/request-otp` → `POST /api/v1/auth/verify-otp`. Both endpoints return the **same response whether or not the number is registered**, so they can't be used to enumerate riders. Codes are stored only as bcrypt hashes with a TTL, resend cooldown, and per-phone/day + per-IP/hour abuse caps.
2. **Staff/admins — Google SSO.** "Continue with Google"; the backend verifies the Google `id_token` and bootstraps admins listed in `GOOGLE_ADMIN_EMAILS`. Set `GOOGLE_ADMIN_EMAILS` per environment in `localsettings.py` (empty by default), and add each serving origin (`http://localhost:5004`, `https://riderpro.printo.in`) to the OAuth client's **Authorized JavaScript origins** in Google Cloud Console — otherwise the button is blocked.

> **No self-signup.** The old password-based signup/login is **retired**. Riders are provisioned by **POPS sync** (manager-gated) into `RiderAccount`; removal is a **soft-archive**. A rider must be approved, active, and non-archived to receive an OTP. Vehicle is confirmed *after* login at day-start (admin-approved), not at signup.

> **OTP delivery (Botspace):** WhatsApp numbers must be E.164 with a leading `+` and country code (e.g. `+919940117071`). Rider phones are stored as bare 10 digits, so the Botspace sender normalizes to `+<cc><number>` (default `91`, override via `OTP_DEFAULT_COUNTRY_CODE`) — a bare 10-digit number is rejected by Botspace with *"Invalid phone number"*. Botspace host is `public-api.bot.space` (NOT `api.botspace.co`). In dev, set `OTP_PROVIDER=console` to log the code instead of sending WhatsApp.

### Roles & Access

- **Super User**: Full access (all data + system config)
- **Ops Team/Staff**: All shipments, all routes, all metrics
- **Riders/Drivers**: Own shipments only, own routes only

## 🔄 Bidirectional Integration System

RiderPro provides a complete **bidirectional integration system** with clean
architecture that allows external systems to:

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

- **API Key (recommended for service-to-service)**: Include `x-api-key` header with your API key
- **JWT Token**: Include `Authorization: Bearer <token>` header
- **Optional**: `X-Service-Name` header for service identification

> ⚠️ **Use `x-api-key`, not a long-lived JWT, for service integrations.** Rotating
> RiderPro's `SECRET_KEY` invalidates **every** JWT, so a cached `Bearer` service
> token silently breaks on rotation (you'll see *"Given token not valid for any
> token type"*). The static `x-api-key` is independent of `SECRET_KEY` and survives
> rotations. POPS/PIA uses `x-api-key` for exactly this reason.

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
      "pickup_address": "..." // Optional for pickup orders
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

> ℹ️ **Two independent outbound paths exist:** (1) the **custom callbacks** below
> (`post_save` signals → `external_callback_service.py` → the integration's
> `callback_url`), and (2) a direct **POPS status sync**
> (`ShipmentStatusService._sync_to_pops` → POPS `/deliveryq/status-update/`).
> As of now, path (1) is dormant for POPS/PIA (no receiver endpoint, so
> `callback_url` is left empty), and path (2) is **not functional** — it targets
> POPS's Locus-courier callback endpoint, which needs a permission grant for the
> service account and a nested `{"order": {...}}` payload. Restoring POPS status
> sync requires POPS-side changes; it does not affect inbound order ingestion.

#### Automatic Callbacks

RiderPro automatically sends callbacks when:

- **Shipment Created**: New shipment received from external system
- **Status Changed**: Shipment status updated (Assigned → In Transit →
  Delivered)
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
  -H "x-api-key: <your-x-api-key>" \
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

2. **Update Configuration**: Replace example URLs with real callback URLs in
   `localsettings.py`

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
docker compose up --build   # Full stack (Django + Vite + Postgres), hot reload
npm run dev                 # Vite frontend ONLY (port 5004) — does not start Docker/backend

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

> Prod actually deploys via **`./deploy.sh [frontend|backend|both]`** (uses `docker-compose.prod.yml`). It `git pull`s, rebuilds/recreates the chosen container(s), runs migrate/collectstatic for the backend, and runs a **smoke test** that warns if `/admin-dashboard` stops serving the SPA. Use `SYNC_NGINX=1 ./deploy.sh …` to also push the repo's nginx config to the server (`nginx -t` + auto-rollback). Prefer `frontend`/`backend` over `both` for routine deploys (`both` prunes volumes).

### Nginx routing (important)

Host nginx (`/etc/nginx/conf.d/riderpro.conf`, mirrored in repo `nginx/conf.d/riderpro.conf`) routes `/api/`, `/admin/`, `/static/`, `/media/`, `/health` → Django (`:8004`) and everything else → the SPA (`:5004`). The Django-admin block **must** be `location ^~ /admin/` (trailing slash) — a greedy `^~ /admin` also catches SPA routes like `/admin-dashboard` / `/admin-riders` and 404s them on hard-refresh.

### Production settings

Prod runs `DEBUG=False`, set in the server's gitignored `backend/riderpro/localsettings.py` (imported last in `settings.py`; see `localsettings.example.py`). Keep it `False` — a debug error page leaks internals.

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
│   │   └── services/    # Business logic and API clients
├── backend/             # Django backend
│   ├── apps/            # Django apps (shipments, routes, authentication, etc.)
│   ├── settings/        # Django settings
│   └── manage.py        # Django management entry point
├── shared/              # Shared types between frontend and backend
└── docker-compose.yml   # Docker configuration
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
User Login → Role Check → Filter queries by employee_id (riders) or all data (admin/ops)
```

## 🎯 Technology Stack

**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query\
**Backend**: Django, Django REST Framework, Python 3.12\
**Database**: PostgreSQL 15 with connection pooling\
**Infrastructure**: Docker, Docker Compose

## ⚙️ Environment Variables

```bash
# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/riderpro_django
BACKUP_DATABASE_URL=postgres://postgres:password@localhost:5433/riderpro_django_backup

# Server
NODE_ENV=development
DEPLOYMENT_ENV=localhost
PORT=5000

# Security
JWT_SECRET=your-secret-key-32-chars-min

# Rider OTP login (WhatsApp via Botspace)
OTP_PROVIDER=botspace                 # 'botspace' (prod WhatsApp) or 'console' (dev: logs the code)
OTP_DEFAULT_COUNTRY_CODE=91           # prepended to bare 10-digit phones before sending
OTP_TTL_SECONDS=300                   # code lifetime
OTP_RESEND_COOLDOWN=45                # seconds between resends per phone
OTP_MAX_ATTEMPTS=5                    # verify attempts before a code is locked
OTP_MAX_PER_PHONE_PER_DAY=10          # abuse cap
OTP_MAX_PER_IP_PER_HOUR=30            # abuse cap
BOTSPACE_API_BASE=https://public-api.bot.space/v1   # NOT api.botspace.co
BOTSPACE_API_KEY=...                  # Botspace API key
BOTSPACE_CHANNEL_ID=...               # WhatsApp channel id
BOTSPACE_OTP_TEMPLATE=riderpro_otp    # approved WhatsApp template id

# Google SSO (staff/admin login)
GOOGLE_OAUTH_CLIENT_ID=...            # public by design; mirror in VITE_GOOGLE_CLIENT_ID
GOOGLE_ADMIN_EMAILS=a@x.com,b@x.com   # comma-separated; empty by default (nobody bootstraps as admin)
```

## ⏰ Cron Jobs & Database Maintenance

RiderPro includes automated cron jobs and database maintenance tasks to ensure
optimal performance and data management.

### 🗄️ Database Backup System

#### **Daily Backup Cron Job**

- **Script**: `scripts/setup-db-backup-cron.sh`
- **Schedule**: Daily at 2:00 AM (`0 2 * * *`)
- **Purpose**: Creates automatic database backups
- **Backup Script**: `scripts/backup-db.sh`
- **Storage**: Backups saved in `./db-dumps/` directory
- **Support**: Both Docker PostgreSQL (local dev) and direct PostgreSQL
  (production)

#### **Setup Backup Cron Job**

```bash
# Run the setup script to configure automatic backups
./scripts/setup-db-backup-cron.sh

# Manual backup (if needed)
./scripts/backup-db.sh
```

### 🔄 3-Day Replica Database System

#### **Automatic Replica Maintenance**

- **Schedule**: Daily at 1:00 AM (`0 1 * * *`)
- **Purpose**: Maintains replica database with last 3 days of data
- **Environment**: Dev/Alpha environments only (disabled in production)
- **Cleanup**: Automatically removes data older than 3 days

#### **Replica Database Features**

- **Data Retention**: Exactly 3 days of latest records from main database
- **Sync Process**: Automatic synchronization from main database
- **Purpose**: Testing with realistic recent data without full production
  dataset

#### **Replica Sync Query**

```sql
-- Cleanup old data (older than 3 days)
DELETE FROM shipments WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '3 days');

-- Sync recent data from main to replica
INSERT INTO shipments (...)
SELECT * FROM main_db.shipments
WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE ...;
```

### 🧹 Data Cleanup Tasks

#### **Route Data Cleanup** (Deprecated)

- **File**: `deprecated/server/services/scheduler.ts`
- **Schedule**: Daily at 3:00 AM (`0 3 * * *`)
- **Purpose**: Deletes route tracking data older than 30 days
- **Query**: `DELETE FROM route_tracking WHERE date < cutoff_date`

#### **Audit Log Cleanup**

- **Retention**: 90 days
- **Purpose**: Automatic cleanup of old audit logs
- **Function**: `cleanupOldAuditLogs(90)`

#### **Performance Metrics Cleanup**

- **Retention**: 1 hour
- **Scope**: Client-side performance metrics
- **Purpose**: Prevents memory bloat in browser

### 📋 Database Management Commands

#### **Complete Database Management**

```bash
# Database manager script (comprehensive tool)
./scripts/db_manager.sh dump [local|prod] [output_file]
./scripts/db_manager.sh restore [local|prod] [input_file]
./scripts/db_manager.sh reset [local|prod]
./scripts/db_manager.sh setup-permissions [local|prod]
./scripts/db_manager.sh migrate [local|prod]
./scripts/db_manager.sh list
```

#### **Backup Operations**

```bash
# Create backup
./scripts/backup-db.sh

# List available dumps
./scripts/db_manager.sh list

# Restore from backup
./scripts/db_manager.sh restore local riderpro_django_20240216_020000.dump
```

### 🗂️ File Structure for Maintenance

```
scripts/
├── setup-db-backup-cron.sh    # Setup automatic backup cron job
├── backup-db.sh               # Manual backup script
├── db_manager.sh              # Complete database management tool
├── restore-db.sh              # Restore database from backup
└── rollback-frontend.sh     # Frontend rollback with cleanup

deprecated/server/services/
└── scheduler.ts               # Legacy scheduler (route cleanup)

dist/vercel.js                # Active compiled cron jobs
```

### ⚙️ Configuration

#### **Environment Variables for Replica**

```bash
# Main database
DATABASE_URL=postgres://postgres:password@localhost:5432/riderpro

# Replica database (dev/alpha only)
BACKUP_DATABASE_URL=postgres://postgres:password@localhost:5433/riderpro_backup
```

#### **Cron Job Management**

```bash
# View current cron jobs
crontab -l

# Edit cron jobs
crontab -e

# Remove backup cron job
crontab -l | grep -v "backup-db.sh" | crontab -
```

### 📊 Maintenance Summary

| Task                | Schedule            | Purpose                    | Environment    |
| ------------------- | ------------------- | -------------------------- | -------------- |
| Database Backup     | Daily 2:00 AM       | Full database backup       | All            |
| Replica Cleanup     | Daily 1:00 AM       | Keep last 3 days           | Dev/Alpha only |
| Route Data Cleanup  | Daily 3:00 AM       | Delete 30+ day old data    | Deprecated     |
| Audit Log Cleanup   | Manual/Configurable | Delete 90+ day old logs    | All            |
| Performance Metrics | Every 30 sec        | Delete 1+ hour old metrics | Client-side    |

### 🔍 Monitoring & Logs

#### **Backup Logs**

- **Location**: `./db-backup-cron.log`
- **Content**: Backup operation results and errors

#### **Database Health**

- **Endpoint**: `/health` (includes database status)
- **Monitoring**: Automatic health checks with caching

#### **Manual Verification**

```bash
# Check database connection
curl http://localhost:5000/health

# Verify backup files
ls -la ./db-dumps/

# Check cron job status
crontab -l | grep backup
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

### "Couldn't send the verification code right now" on Send OTP

The user-facing message is intentionally generic; the real cause is logged server-side. On the prod server:

```bash
docker compose -f docker-compose.prod.yml logs django --since 30m 2>&1 | grep -i "botspace\|OTP"
```

Common causes: (1) `Botspace OTP send failed ... "Invalid phone number"` → the number reached Botspace without a `+`/country code (fixed by the sender's E.164 normalization; check `OTP_DEFAULT_COUNTRY_CODE`); (2) `... is not configured` → a missing `BOTSPACE_*` env var; (3) a 4xx from Botspace → rotated API key, wrong `BOTSPACE_CHANNEL_ID`, or the `riderpro_otp` template not approved.

### `/admin-dashboard` (or other `/admin-*` SPA routes) 404 on hard-refresh

The nginx Django-admin location is too greedy. It must be `location ^~ /admin/` (trailing slash) so it matches **only** the Django admin site; a bare `^~ /admin` also catches SPA routes like `/admin-dashboard` / `/admin-riders` and proxies them to Django. Fix on the server, then `sudo nginx -t && sudo systemctl reload nginx`. (In-app menu navigation works regardless — it's client-side routing; only direct loads / hard-refresh hit nginx.)

## 📖 Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Architecture, conventions, workflows, and guidance for AI coding assistants (also useful as the contributor quick-reference).

### Integration Endpoints

| Endpoint                                   | Method | Purpose                              |
| ------------------------------------------ | ------ | ------------------------------------ |
| `/api/v1/shipments/receive`                | POST   | Main webhook for receiving shipments |
| `/api/v1/webhooks/receive-shipments-batch` | POST   | Dedicated batch processing           |
| `/api/v1/callbacks/test`                   | POST   | Test callback URLs                   |
| `/api/v1/callbacks/send`                   | POST   | Manual callback trigger              |
| `/api/v1/analytics/api-sources`            | GET    | Integration analytics                |

## 📄 License

MIT License - see LICENSE file

---

**Version**: PostgreSQL Migration + Bidirectional Integration Complete\
**Date**: February 2026\
**Status**: ✅ Production Ready with Clean Architecture Integration System
