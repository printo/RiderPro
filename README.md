# RiderPro - Delivery Management System

Complete PostgreSQL-based logistics platform with real-time GPS tracking, route optimization, and role-based access control.

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

## 📊 Key Features

### Core
- Real-time shipment tracking with GPS
- Smart route optimization
- Digital acknowledgments (photo + signature)
- Batch operations
- Advanced analytics
- Offline sync

### Technical
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

### Deploy new code
```bash
docker compose up -d --build
```

### Restart services
```bash
docker compose restart
```

### Reboot server
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

### External → Database
```
Printo API → Webhook → Validation → PostgreSQL (main)
                                   ↓
                       [Dev/Alpha] PostgreSQL (backup, last 3 days)
```

### Rider Updates → External
```
Rider App → PostgreSQL → Async External API Call → Update sync status
```

### UI Data Access (Role-Based)
```
User Login → Role Check → Filter queries by employeeId (riders) or all data (admin/ops)
```

## 🎯 Technology Stack

**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query  
**Backend**: Node.js, Express, TypeScript  
**Database**: PostgreSQL 15 with connection pooling  
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

- **DATABASE.md** - Database schema and queries
- **Code comments** - Inline documentation in source files

## 📄 License

MIT License - see LICENSE file

---

**Version**: PostgreSQL Migration Complete  
**Date**: January 2026  
**Status**: ✅ Production Ready
