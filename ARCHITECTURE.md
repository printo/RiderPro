# Architecture — RiderPro

> System design, folder structure, data flow, and component boundaries.

---

## High-Level System Design

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (React SPA)                │
│  Vite Dev Server :5004  →  Static Build in /dist    │
│                                                     │
│  Pages → Hooks → Services → ApiClient → /api/v1/*  │
│                    ↕                                │
│         IndexedDB (offline queue)                   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (Vite proxy in dev)
                       ▼
┌─────────────────────────────────────────────────────┐
│              BACKEND (Django + DRF)                  │
│              Server :8000                            │
│                                                     │
│  URLs → Views → Serializers → ORM → PostgreSQL      │
│                    ↕                                 │
│         Signals → External Callback Service          │
│                    ↕                                 │
│         External Systems (POPS, Webhooks)            │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              PostgreSQL 15                           │
│  Tables: users, shipments, route_sessions,          │
│          route_tracking, vehicles, fuel_settings,    │
│          homebases, acknowledgments                  │
└─────────────────────────────────────────────────────┘
```

---

## Project Folder Structure

```
RiderPro/
│
├── client/                         # ── FRONTEND (React SPA) ──
│   ├── src/
│   │   ├── App.tsx                 # Root component: routing + auth gate
│   │   ├── main.tsx                # Vite entry: PWA registration
│   │   ├── index.css               # Tailwind directives + CSS variables
│   │   │
│   │   ├── config/
│   │   │   └── api.ts              # Centralized API endpoint map
│   │   │
│   │   ├── services/               # Business logic (singleton classes)
│   │   │   ├── ApiClient.ts        # HTTP client: auth, retry, offline queue
│   │   │   ├── AuthService.ts      # Login/logout, token management
│   │   │   ├── GPSTracker.ts       # Geolocation API wrapper
│   │   │   ├── RouteSession.ts     # Route lifecycle management
│   │   │   ├── RouteAnalyzer.ts    # Route metrics computation
│   │   │   ├── FuelCalculator.ts   # Fuel cost calculations
│   │   │   ├── OfflineStorageService.ts  # IndexedDB for offline sync
│   │   │   ├── ErrorHandlingService.ts   # Error classification + recovery
│   │   │   ├── DataExporter.ts     # CSV/JSON export
│   │   │   ├── DistanceCalculator.ts    # Geospatial math
│   │   │   └── GPSErrorRecoveryService.ts
│   │   │
│   │   ├── hooks/                  # Custom React hooks
│   │   │   ├── useAuth.ts          # Auth state subscription
│   │   │   ├── useDashboard.ts     # Dashboard data fetching
│   │   │   ├── useGPSTracking.ts   # GPS tracking lifecycle
│   │   │   ├── useRouteSession.ts  # Route session hook
│   │   │   ├── useRouteAnalytics.ts # Analytics queries
│   │   │   ├── useLiveTracking.ts  # Real-time tracking
│   │   │   ├── useOfflineSync.ts   # Sync status + triggers
│   │   │   └── useSmartRouteCompletion.ts
│   │   │
│   │   ├── contexts/               # React context providers
│   │   │   ├── ThemeContext.tsx     # Light/dark mode
│   │   │   └── RouteSessionContext.tsx
│   │   │
│   │   ├── pages/                  # Route-level page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ShipmentsWithTracking.tsx
│   │   │   ├── Admin.tsx
│   │   │   ├── AdminRiderManagement.tsx
│   │   │   ├── RouteAnalytics.tsx
│   │   │   ├── RouteVisualizationPage.tsx
│   │   │   ├── LiveTrackingDashboard.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── RiderSignupForm.tsx
│   │   │   └── NotFound.tsx
│   │   │
│   │   ├── components/             # Reusable UI components
│   │   │   ├── ui/                 # shadcn/ui primitives (60+ components)
│   │   │   │   ├── button.tsx, card.tsx, dialog.tsx, form.tsx ...
│   │   │   │   └── forms/          # Modal forms
│   │   │   │       ├── BatchUpdateModal.tsx
│   │   │   │       ├── FuelSettingsModal.tsx
│   │   │   │       └── RemarksModal.tsx
│   │   │   ├── shipments/          # Shipment domain components
│   │   │   ├── routes/             # Route visualization components
│   │   │   ├── analytics/          # Chart + metric components
│   │   │   ├── tracking/           # Live tracking components
│   │   │   ├── fuel/               # Fuel management components
│   │   │   ├── sync/               # Offline sync UI
│   │   │   ├── Navigation.tsx      # App header + nav
│   │   │   ├── LoginForm.tsx       # Auth entry
│   │   │   └── ErrorBoundary.tsx   # Error boundary wrapper
│   │   │
│   │   ├── lib/                    # Shared utilities
│   │   │   ├── queryClient.ts      # TanStack Query config
│   │   │   ├── roles.ts            # Role-based access helpers
│   │   │   └── utils.ts            # General helpers (cn, formatters)
│   │   │
│   │   ├── utils/
│   │   │   └── logger.ts           # Dev logging utility
│   │   │
│   │   └── styles/
│   │       └── mobile.css          # Mobile-specific overrides
│   │
│   ├── public/                     # Static assets (icons, manifest)
│   └── index.html                  # HTML shell
│
├── backend/                        # ── BACKEND (Django) ──
│   ├── manage.py                   # Django CLI
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Backend container
│   │
│   ├── riderpro/                   # Django project config
│   │   ├── settings.py             # Core settings (DB, auth, apps, JWT)
│   │   ├── urls.py                 # Root URL routing
│   │   ├── wsgi.py / asgi.py       # Server interfaces
│   │   ├── localsettings.py        # Local overrides (git-ignored)
│   │   └── docs_views.py           # API docs Scalar view
│   │
│   └── apps/                       # Django applications
│       ├── authentication/         # User management + auth
│       │   ├── models.py           # Custom User model (roles, POPS tokens)
│       │   ├── views.py            # Login, register, approve, password reset
│       │   ├── serializers.py      # User serializers
│       │   ├── backends.py         # Custom auth backend
│       │   ├── jwt_auth.py         # JWT + cookie auth classes
│       │   └── urls.py
│       │
│       ├── shipments/              # Core business logic (largest app)
│       │   ├── models.py           # Shipment, Acknowledgment, AcknowledgmentSettings
│       │   ├── views.py            # Shipment CRUD, batch ops, tracking
│       │   ├── serializers.py      # Request/response formatting
│       │   ├── filters.py          # Query filtering (status, date, rider)
│       │   ├── analytics_views.py  # Analytics endpoints
│       │   ├── admin_views.py      # Admin-only operations
│       │   ├── callback_views.py   # External callback handlers
│       │   ├── pops_order_receiver.py   # POPS integration inbound
│       │   ├── external_callback_service.py  # Webhook sender
│       │   ├── services.py         # Business logic layer
│       │   ├── signals.py          # Post-save triggers
│       │   └── urls.py
│       │
│       ├── vehicles/               # Vehicle + fuel configuration
│       │   ├── models.py           # VehicleType, FuelSetting
│       │   ├── views.py            # CRUD endpoints
│       │   └── serializers.py
│       │
│       ├── routes/                 # Route tracking + analytics
│       │   ├── models.py           # RouteSession, RouteTracking
│       │   ├── views.py            # Start/stop/track routes
│       │   └── serializers.py
│       │
│       ├── sync/                   # External system integration
│       │   └── [models, views, serializers]
│       │
│       └── core/                   # Cross-cutting concerns
│           └── middleware.py        # Custom middleware
│
├── shared/                         # ── SHARED CODE ──
│   ├── types.ts                    # TypeScript type definitions
│   ├── schema.ts                   # Zod schemas + interfaces
│   ├── syncStatus.ts               # Sync status enums
│   └── utils/
│       └── logger.ts               # Shared logger
│
├── scripts/                        # ── UTILITY SCRIPTS ──
│   ├── db_manager.sh               # Database management
│   ├── backup-db.sh                # DB backup
│   └── setup-db-backup-cron.sh     # Backup scheduling
│
├── ── DOCUMENTATION ──
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── AI_PROJECT_CONTEXT.md
│   ├── AI_GUARDRAILS.md
│   ├── TASK_RULES.md
│   ├── API_REFERENCE.md
│   ├── DATABASE_SCHEMA.md
│   ├── BACKEND_MIGRATION_GUIDE.md
│   └── SMART_ROUTE_DETAILS.md
│
├── ── CONFIG FILES ──
│   ├── package.json                # Node dependencies + scripts
│   ├── tsconfig.json               # TypeScript config (strict)
│   ├── vite.config.ts              # Vite: aliases, proxy, PWA
│   ├── tailwind.config.ts          # Tailwind: theme, plugins
│   ├── postcss.config.js           # PostCSS pipeline
│   ├── eslint.config.js            # ESLint 9 flat config
│   ├── docker-compose.yml          # Docker services
│   ├── Dockerfile / Dockerfile.prod # Container builds
│   └── .env.example                # Environment template
│
└── ── ROOT DOCUMENTATION ──
    ├── README.md
    ├── ARCHITECTURE.md
    ├── AI_GUARDRAILS.md
    ├── AI_PROJECT_CONTEXT.md
    └── TASK_RULES.md
```

---

## Directory Responsibilities

| Directory | Responsibility | Modify When |
|-----------|---------------|-------------|
| `client/src/pages/` | Full-page route components | Adding/changing pages |
| `client/src/components/ui/` | shadcn/ui primitives | Adding new UI primitives (rare) |
| `client/src/components/{domain}/` | Domain-specific components | Feature work in that domain |
| `client/src/services/` | Business logic singletons | Changing core logic, API patterns |
| `client/src/hooks/` | React hook wrappers | Adding reusable stateful logic |
| `client/src/contexts/` | App-wide state providers | Adding new global state |
| `client/src/config/api.ts` | API endpoint registry | Adding/changing API endpoints |
| `client/src/lib/` | Shared utilities | Adding helpers used across files |
| `backend/apps/authentication/` | User model, auth flows | Auth or role changes |
| `backend/apps/shipments/` | Core business logic | Shipment features, tracking, sync |
| `backend/apps/vehicles/` | Vehicle + fuel config | Vehicle management features |
| `backend/apps/routes/` | Route tracking | GPS route features |
| `backend/apps/sync/` | External integrations | Integration changes |
| `backend/riderpro/` | Django project config | Settings, URL routing |
| `shared/` | Types shared across stack | Changing data contracts |

---

## Data Flow

### Frontend Request Lifecycle

```
User Action (click, form submit)
       │
       ▼
Page / Component
       │
       ▼
Custom Hook (useAuth, useDashboard, etc.)
       │
       ▼
Service Class (AuthService, RouteSession, etc.)
       │
       ▼
ApiClient.ts (singleton)
  ├── Attaches JWT Bearer token
  ├── Retries on failure (3x, exponential backoff)
  └── Queues request if offline → IndexedDB
       │
       ▼
TanStack React Query (cache layer)
       │
       ▼
Component re-renders with new data
```

### Backend Request Lifecycle

```
HTTP Request → /api/v1/*
       │
       ▼
Django URL Router (riderpro/urls.py → app/urls.py)
       │
       ▼
JWT Authentication Middleware
       │
       ▼
DRF View / ViewSet
       │
       ▼
Serializer (validate input, format output)
       │
       ▼
Service Layer / ORM Queries
       │
       ▼
PostgreSQL
       │
       ▼
Django Signals (post_save)
       │
       ▼
External Callback Service (webhooks to POPS, etc.)
       │
       ▼
JSON Response → Frontend
```

### Offline Sync Flow

```
App goes offline
       │
       ▼
Requests queue in IndexedDB (OfflineStorageService)
  ├── GPS coordinates
  ├── Route session data
  └── Pending API calls (50 max, 5-min TTL)
       │
App comes back online
       │
       ▼
OfflineStorageService.syncQueue()
       │
       ▼
Batch upload to backend
       │
       ▼
Conflict resolution (server wins by default)
       │
       ▼
Clear synced items from IndexedDB
```

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Wouter** over React Router | Lightweight (~2KB), sufficient for SPA routing |
| **TanStack Query** for server state | Built-in cache, refetch, stale management |
| **Singleton services** | Single instance for ApiClient, AuthService — avoids multiple token managers |
| **IndexedDB for offline** | Large storage capacity, structured data, async API |
| **Django signals for callbacks** | Decouples webhook sending from view logic |
| **JWT + Cookie dual auth** | Supports both API clients and browser sessions |
| **Vite proxy** in dev | Avoids CORS issues; production uses same-origin deployment |
| **shadcn/ui** | Copy-paste components — full ownership, no version lock-in |
| **PostgreSQL** | Migrated from SQLite for performance (20-100x faster) |
| **Zod + React Hook Form** | Runtime validation matching TypeScript types |

---

## Component Boundaries

### Frontend Boundaries
- **Pages** depend on **hooks** and **components** — never on services directly
- **Hooks** wrap **services** and provide React-compatible state
- **Services** handle business logic and call **ApiClient**
- **ApiClient** is the only module that makes HTTP requests
- **Components** are stateless when possible; state lives in hooks/contexts
- **`shared/`** types are imported by both frontend services and components

### Backend Boundaries
- **Views** handle HTTP concerns only — delegate logic to services/ORM
- **Serializers** handle validation and formatting — no business logic
- **Models** define data structure and database-level constraints
- **Signals** handle side effects — never called from views directly
- **External callback service** is the only module that sends webhooks

### Cross-Stack Boundary
- Frontend and backend communicate **only** via `/api/v1/` REST endpoints
- Shared types in `shared/` define the data contract
- No direct database access from frontend — always through API
- No frontend-specific logic in backend — always through serializers

---

## API Endpoint Groups

| Group | Base Path | Backend App |
|-------|-----------|-------------|
| Auth | `/api/v1/auth/` | `authentication` |
| Shipments | `/api/v1/shipments/` | `shipments` |
| Routes | `/api/v1/routes/` | `routes` |
| Vehicle Types | `/api/v1/vehicle-types/` | `vehicles` |
| Fuel Settings | `/api/v1/fuel-settings/` | `vehicles` |
| Admin | `/api/v1/admin/` | `shipments` (admin_views) |
| Analytics | `/api/v1/shipments/analytics/` | `shipments` (analytics_views) |
| Dashboard | `/api/v1/shipments/dashboard/` | `shipments` |
| Health | `/api/v1/health` | `riderpro` |
| API Docs | `/api/docs/` | `riderpro` (Scalar UI) |

---

## Role-Based Access

| Role | Access Level |
|------|-------------|
| **Super User / Admin** | Full system access, user approval, all shipments |
| **Ops Team** | All shipments, route management, analytics |
| **Staff** | View all shipments, basic management |
| **Driver** | Own shipments only, GPS tracking, route sessions |
| **Viewer** | Read-only access to own data |

Role checks: `lib/roles.ts` (frontend) + `User.role` field (backend)

### Detailed Permission Matrix

| Feature                | Driver   | Manager | Admin  |
| ---------------------- | -------- | ------- | ------ |
| View Own Shipments     | ✅       | ✅      | ✅     |
| View All Shipments     | ❌       | ✅      | ✅     |
| Create Shipments       | ❌       | ✅      | ✅     |
| Update Shipments       | ✅ (own) | ✅      | ✅     |
| Delete Shipments       | ❌       | ✅      | ✅     |
| GPS Tracking           | ✅       | ❌      | ❌     |
| Route Management       | ✅ (own) | ✅      | ✅     |
| Analytics              | Basic    | Full    | Full   |
| User Management        | ❌       | ❌      | ✅     |
| System Settings        | ❌       | ❌      | ✅     |
| Admin Page Access      | ❌       | ❌      | ✅     |
| Batch Operations       | ❌       | ✅      | ✅     |
| Data Export            | ❌       | ✅      | ✅     |
| Upload Acknowledgments | ✅       | ✅      | ✅     |

### Token Management

- **Access Token**: JWT stored in cookies (HTTP-only) or localStorage (`local_<timestamp>_<userId>`)
- **Validation**: Middleware extracts user ID from token and validates against database.
- **Security**: bcrypt hashing (12 salt rounds) for passwords; tokens cleared on logout.
