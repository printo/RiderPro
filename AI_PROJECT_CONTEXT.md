# AI Project Context — RiderPro

> **Single source of truth for AI coding assistants.**
> Read this file FIRST before making any code changes.

---

## Project Overview

**RiderPro** is a production-ready delivery management and GPS tracking platform. It provides real-time shipment tracking, route optimization, rider management, and analytics for logistics operations.

**Core Capabilities:**
- Real-time GPS tracking of riders during deliveries
- Shipment lifecycle management (create → assign → in-transit → delivered)
- Route session recording with coordinate batching
- Offline-first architecture with automatic sync
- Role-based access control (Admin, Manager, Driver, Viewer)
- Bidirectional integration with external systems (POPS)
- Digital acknowledgments (signature + photo capture)
- Analytics dashboards with performance metrics

---

## Tech Stack

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 18.3.1 |
| Language | TypeScript (strict mode) | 5.6.3 |
| Build Tool | Vite | 7.1.10 |
| Styling | Tailwind CSS | 3.4.17 |
| UI Components | Radix UI (shadcn/ui) | Latest |
| Routing | Wouter | 3.3.5 |
| Server State | TanStack React Query | 5.60.5 |
| Forms | React Hook Form + Zod | 7.55.0 / 3.24.2 |
| HTTP Client | Axios | 1.12.0 |
| Maps | Leaflet + React Leaflet | 1.9.4 / 4.2.1 |
| Charts | Recharts | 2.15.2 |
| Animations | Framer Motion | 11.13.1 |
| PWA | Vite PWA Plugin | — |

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Django | 4.2.x |
| API | Django REST Framework | 3.14.0 |
| Auth | Simple JWT | 5.2.0 |
| Database | PostgreSQL | 15 |
| DB Adapter | psycopg2-binary | 2.9.0 |
| CORS | django-cors-headers | 4.0.0 |
| API Docs | drf-spectacular (Scalar UI) | 0.26.0 |
| Filtering | django-filter | 23.0 |
| Import/Export | django-import-export | 4.1.0 |

### Infrastructure
| Tool | Purpose |
|------|---------|
| Docker + Docker Compose | Containerization |
| Node.js >= 24.0 | Frontend runtime |
| PostgreSQL 15 | Primary database |

---

## Runtime Environment

- **Frontend dev server**: Port `5004` (Vite)
- **Backend server**: Port `8000` (Django), exposed as `8004` via Docker
- **Database**: Port `5432` (host) / `5433` (Docker mapped)
- **API Proxy**: Vite proxies `/api` requests to Django at `localhost:8000`
- **Base API path**: `/api/v1/`

---

## Approved Dependencies

> **Do NOT add new dependencies without explicit approval.**

### Frontend — Approved
- React, React DOM, TypeScript
- Radix UI primitives (any `@radix-ui/*` package)
- TanStack React Query
- Wouter (router)
- Axios (HTTP)
- Zod (validation)
- React Hook Form
- Leaflet / React Leaflet (maps)
- Recharts (charts)
- Framer Motion (animations)
- Tailwind CSS + tailwindcss-animate
- class-variance-authority, clsx, tailwind-merge (utility)
- date-fns, lucide-react

### Backend — Approved
- Django, DRF, Simple JWT
- psycopg2-binary, django-cors-headers
- django-filter, drf-spectacular
- django-import-export, bcrypt, requests

---

## Coding Standards

### TypeScript / React
- **Strict mode** enabled — no `any` types unless absolutely necessary
- **Functional components** only — no class components
- **Custom hooks** for reusable logic (`use*.ts` in `hooks/`)
- **Service classes** for business logic (singleton pattern in `services/`)
- **Zod schemas** for runtime validation
- **Path aliases**: `@/` → `client/src/`, `@shared/` → `shared/`
- Use existing shadcn/ui components from `components/ui/` — do not create competing UI primitives
- Tailwind utility classes for styling — no inline styles or CSS modules

### Python / Django
- Django ORM for all database access — no raw SQL unless performance-critical
- DRF serializers for all API request/response formatting
- DRF ViewSets or APIViews for endpoints
- JWT authentication via Simple JWT
- Custom User model at `authentication.User`
- Django signals for side effects (e.g., external callbacks)

### General
- No `console.log` in production code — use the project's logger utility
- Prefer named exports over default exports (pages are the exception)
- Keep files focused — one component/service/hook per file
- Follow existing naming conventions in each directory

---

## Environment Configuration

Environment variables are defined in `.env` (git-ignored). Template: `.env.example`

**Key Variables:**
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing key |
| `SESSION_SECRET` | Session encryption |
| `PIA_API_KEY` | External integration key |
| `POPS_JWT_SECRET` | POPS authentication |
| `CORS_ORIGINS` | Allowed frontend origins |
| `ROUTE_TRACKING_ENABLED` | Feature flag: GPS tracking |
| `OFFLINE_SYNC` | Feature flag: offline mode |
| `ANALYTICS_ENABLED` | Feature flag: analytics |

**Rules:**
- Never hardcode secrets or API keys
- Never commit `.env` files
- Always use environment variables for configuration that varies by deployment

---

## Testing Strategy

| Method | Tool | Command |
|--------|------|---------|
| Type checking | TypeScript compiler | `npm run check` |
| Linting | ESLint 9 | `npm run lint` |
| Lint (check only) | ESLint 9 | `npm run lint:check` |
| API testing | drf-spectacular + Scalar UI | `/api/docs/` |

> No dedicated test framework is currently configured. Validate changes via type checking, linting, and manual testing.

---

## Documentation Rules

- Update `CHANGES.md` when adding features or fixing significant bugs
- API changes must be reflected in serializers and drf-spectacular schemas
- Do not create new markdown documentation files unless explicitly asked
- Refer to existing docs: `README.md`, `system-architecture.md`, `database-schema.md`, `api-documentation.md`, `authentication-system.md`

---

## Instructions for AI Assistants

1. **Read before writing** — Always read relevant files before modifying them
2. **Minimal changes** — Change only what is necessary to accomplish the task
3. **Respect patterns** — Follow existing code patterns in the directory you're modifying
4. **No new dependencies** — Use approved libraries; ask before adding anything new
5. **Type safety** — All new code must be fully typed (TypeScript strict mode)
6. **Test your logic** — Ensure `npm run check` and `npm run lint` pass
7. **Cross-reference** — Read `ARCHITECTURE.md`, `TASK_RULES.md`, and `AI_GUARDRAILS.md` for additional constraints
