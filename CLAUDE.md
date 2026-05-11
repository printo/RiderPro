# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RiderPro** is a delivery management and GPS-tracking platform. Frontend is a React SPA; backend is Django + DRF with PostgreSQL 15. External systems (notably "POPS") integrate bidirectionally via webhook + callback.

There is also a legacy Node/Express server (still referenced by some `package.json` dependencies — `express`, `passport`, `pg`, `node-cron` — and a `deprecated/server/services/scheduler.ts`). New work goes to Django, not Express.

## Development Commands

### Running the stack

```bash
docker compose up --build              # Full stack: Django + Vite + Postgres
npm run dev                            # Vite frontend only (port 5004)
docker compose exec django python manage.py createsuperuser
```

Note: `npm run dev` does NOT start Docker — it only starts the Vite dev server. For the full stack with Django + Postgres, use `docker compose up`.

### Quality gates

```bash
npm run check         # tsc (strict mode, no emit) — must pass
npm run lint          # ESLint 9 with --fix
npm run lint:check    # ESLint without auto-fix
```

There is no JS test framework wired up. Verification = type check + lint + manual testing. Backend API can be explored via Scalar UI at `/api/docs/`.

### Database

```bash
./scripts/db_manager.sh reset local    # drop, recreate, migrate
./scripts/db_manager.sh dump local
./scripts/db_manager.sh list
./scripts/backup-db.sh                 # manual backup → ./db-dumps/
```

Django migrations:
```bash
docker compose exec django python manage.py makemigrations
docker compose exec django python manage.py migrate
```

### Ports

| Service | Port |
|---------|------|
| Vite (frontend) | `5004` |
| Django (host) | `8004` (mapped from container `8000`) |
| Postgres (host) | `5433` (mapped from container `5432`) |
| Legacy Node/Express | `5000` (if running) |

Vite proxies `/api` → `http://django:8000` (container) or `VITE_API_BASE_URL` if set.

## Architecture

### Stack

- **Frontend**: React 18 + TypeScript (strict), Vite 7, Tailwind 3, shadcn/ui (Radix), Wouter (router), TanStack Query (server state), Axios, React Hook Form + Zod, Leaflet, Recharts, vite-plugin-pwa.
- **Backend**: Django 4.2 + DRF, Simple JWT, PostgreSQL 15 via psycopg2, drf-spectacular (Scalar UI), django-filter, django-import-export.
- **Path aliases**: `@/` → `client/src/`, `@shared/` → `shared/`.

### Layered structure — boundaries matter

```
client/src/
  pages/         Route-level components (Wouter routes in App.tsx)
  components/    UI components, organized by domain (shipments/, routes/, analytics/, tracking/, fuel/, sync/)
  components/ui/ shadcn/ui primitives — reuse, do not duplicate
  hooks/         use*.ts — wrap services, expose React state
  services/      Singleton business-logic classes (ApiClient, AuthService, GPSTracker, RouteSession, OfflineStorageService, ...)
  contexts/      React context providers (Theme, RouteSession)
  config/api.ts  Centralized API endpoint map — add new endpoints here
  lib/           queryClient, roles, utils (cn, formatters)

backend/apps/
  authentication/  Custom User model (roles, POPS tokens), JWT, signup/approval
  shipments/       Largest app — Shipment, Acknowledgment, batch ops, analytics, POPS integration, callback dispatch, signals
  vehicles/        VehicleType, FuelSetting
  routes/          RouteSession, RouteTracking (GPS coords)
  sync/            External-system integration models/views
  core/            Cross-cutting middleware

shared/            Types/Zod schemas shared frontend ↔ backend contract (types.ts, schema.ts, syncStatus.ts)
```

Dependency direction (do not invert):
- Pages → hooks → services → `ApiClient` (the **only** HTTP caller). Components are stateless when possible.
- DRF Views → serializers → ORM. **Side effects (webhooks) live in Django signals**, not views. The only module that sends outbound callbacks is `backend/apps/shipments/external_callback_service.py`.
- Inbound POPS integration: `backend/apps/shipments/pops_order_receiver.py`.

### API surface

Everything is under `/api/v1/`. Endpoint groups: `auth/`, `shipments/` (also hosts `dashboard`, `routes/`, analytics, callbacks, admin sub-routes — see `backend/riderpro/urls.py`), `vehicle-types/`, `fuel-settings/`. Docs at `/api/docs/` (Scalar UI) and `/api/schema/`.

Bidirectional integration:
- **Inbound**: `POST /api/v1/shipments/receive` accepts batch payloads, authenticated by `x-api-key` or `Authorization: Bearer <jwt>`. API keys configured in `backend/riderpro/localsettings.py` as `RIDER_PRO_API_KEYS` (each entry has `key`, `callback_url`, `active`, optional `auth_header`).
- **Outbound**: status changes trigger `post_save` Django signals → callback service POSTs to the originating integration's `callback_url`.

### Auth & roles

- JWT (Simple JWT) with cookie + Authorization-header support; custom User model in `apps.authentication`.
- Two auth sources: external Printo API users and local DB users (with an approval workflow — see `ApprovalPending` page).
- Roles: super_user, ops_team, staff, driver, viewer. Backend filters queries by `employee_id` for drivers; frontend gates UI via `client/src/lib/roles.ts` helpers (`isManagerUser`, etc.).

### Offline-first frontend

`OfflineStorageService` queues failed requests + GPS coords in IndexedDB. `ApiClient` retries with exponential backoff and falls back to the queue. Server is the source of truth on conflict. Do not remove retry or offline-queue logic.

## Conventions

- **TypeScript strict mode is required.** Don't disable it. Avoid `any`.
- **Functional components only**, named exports preferred (pages may default-export).
- New API calls go through `ApiClient` — never call `fetch`/`axios` directly elsewhere.
- New data: validate with Zod on the client and DRF serializers on the server; update `shared/types.ts` / `shared/schema.ts` when the contract changes.
- Tailwind utilities only — no inline styles, CSS modules, or competing UI libraries.
- Python: 4-space indent, DRF serializers for all I/O, Django ORM (no raw SQL without a reason). Migrations are mandatory for model changes.
- No `console.log` in production code — use the shared logger (`shared/utils/logger.ts` / `client/src/utils/logger.ts`).

## Full-stack feature workflow (bottom-up)

For a change spanning frontend + backend, work in this order to keep types and contracts in lockstep:

1. Django model in `backend/apps/<app>/models.py`
2. `makemigrations` and review the generated file
3. DRF serializer
4. View / ViewSet
5. Register URL in the app's `urls.py` (and wire into `riderpro/urls.py` if it's a new include)
6. Update `shared/types.ts` / `shared/schema.ts` if the data contract changed
7. Add endpoint constant to `client/src/config/api.ts`
8. Add service method (in an existing service or a new one) — `ApiClient` is the only HTTP caller
9. Add or extend a hook (`use*.ts`) that wraps the service with TanStack Query
10. Wire the hook into the page/component

## File naming

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Services: `PascalCase.ts`
- Python modules: `snake_case.py`

## What to ask before doing

These changes are easy to get wrong and worth confirming:

- Adding any new dependency (frontend or backend). Approved set is already broad — search `package.json` / `backend/requirements.txt` first.
- Changing JWT/auth logic, role checks, or the approval workflow.
- Schema changes — they need migrations + serializer + `shared/` type updates in lockstep.
- Changing API contracts (response shape, field names).
- Touching `localsettings.py`, Docker config, or the Vite proxy.
- Replacing core frameworks (React/Wouter/TanStack Query/Tailwind/Radix on the frontend; Django/DRF/Simple JWT on the backend).

## Useful file locations

| Concern | File |
|---|---|
| Frontend routing + auth gate | `client/src/App.tsx` |
| API endpoint registry | `client/src/config/api.ts` |
| HTTP client (singleton) | `client/src/services/ApiClient.ts` |
| Role helpers | `client/src/lib/roles.ts` |
| Django settings | `backend/riderpro/settings.py` |
| Root URL routing | `backend/riderpro/urls.py` |
| Shipment model/views/serializers | `backend/apps/shipments/{models,views,serializers}.py` |
| POPS inbound | `backend/apps/shipments/pops_order_receiver.py` |
| Outbound callbacks | `backend/apps/shipments/external_callback_service.py` |
| Post-save signal triggers | `backend/apps/shipments/signals.py` |
| Shared types contract | `shared/types.ts`, `shared/schema.ts` |
