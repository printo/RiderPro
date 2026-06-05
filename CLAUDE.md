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

### Deployment (production server)

The server deploys via `./deploy.sh [frontend|backend|both]` (default `both`), which uses **`docker-compose.prod.yml`** — NOT `docker-compose.yml`. It `git pull`s, rebuilds + recreates the chosen container(s), and runs migrate/collectstatic for the backend.

- After pushing: on the server run `git pull && ./deploy.sh` (or `./deploy.sh backend` / `frontend` for a single service — those skip the volume prune).
- `both` mode runs `docker system prune -f --volumes` — prefer `backend`/`frontend` for routine deploys to avoid it.
- Production env (incl. routing keys) is in `.env` on the server (gitignored). A container must be **recreated** (not just restarted) to pick up `.env` changes.
- **Any new `${VAR}` used in compose must be added to BOTH `docker-compose.yml` and `docker-compose.prod.yml`** (the prod file is a separate, standalone config).

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
- **Backend**: Django 4.2 + DRF, Simple JWT, PostgreSQL 15 via psycopg2, drf-spectacular (Scalar UI), django-filter, django-import-export. Road-aware routing via a pluggable provider (OpenRouteService default — see **Routing, mileage & ETAs**).
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
  authentication/  Custom User model (roles, POPS tokens) + RiderAccount (local riders;
                   holds vehicle_type FK + is_approved), VehicleChangeRequest, JWT, signup/approval
  shipments/       Largest app — Shipment, Acknowledgment, RouteSession, RouteTracking,
                   route optimization + auto mileage/ETA, analytics, POPS integration, signals
  vehicles/        VehicleType (km/l mileage), FuelSetting (fuel price)
  sync/            External-system integration models/views
  core/            Cross-cutting middleware

shared/            Types/Zod schemas shared frontend ↔ backend contract (types.ts, schema.ts, syncStatus.ts)
```

Note: there is **no `apps/routes/`** — it was dead and was deleted. `RouteSession`/`RouteTracking`
live in `apps/shipments/`, and all `/routes/*` endpoints are served by `shipments` (`RouteSessionViewSet`).

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

### Routing, mileage & ETAs

- **Pluggable routing provider** — `backend/apps/shipments/routing.py`. `get_routing_backend()` picks a backend by the `ROUTING_PROVIDER` env var: `ors` (OpenRouteService, **default**), `google`, `osrm`, or `haversine`. Every backend **falls back to straight-line Haversine** if its service is unreachable, so routing never hard-fails. Config lives in `.env` (gitignored): `ORS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `OSRM_BASE_URL`, `ROUTING_AVERAGE_SPEED_KMH`, `ROUTING_STOP_SERVICE_SECONDS`. **Mirror any new routing env var into BOTH `docker-compose.yml` and `docker-compose.prod.yml`.**
- **Optimization** — `POST /api/v1/routes/optimize_path` orders a rider's stops by real road travel time (nearest-neighbour). Returns per-stop `eta_minutes`, absolute `eta_clock`, `distance_from_previous_km`, and route totals. ETAs add a per-stop service/dwell allowance (`ROUTING_STOP_SERVICE_SECONDS`, default 180s). The hook `useRouteOptimization` re-optimizes as the rider moves but is **debounced** (re-optimize on stop-count change, else only after moving ≥200 m AND ≥60 s) to protect the ORS free-tier quota — keep that debounce.
- **Auto mileage & fuel** — `finalize_session_metrics()` in `apps/shipments/services.py` computes a session's distance as the **road distance between confirmed pickup/delivery stops** (robust to web-app GPS gaps), falling back to the filtered GPS trail only when there are no confirmed stops. The rider's mileage/fuel-type come from **`RiderAccount.vehicle_type`** — the vehicle lives on `RiderAccount` (keyed by `rider_id`, which equals the session's `employee_id`/username), **NOT** the auth `User` (querying `User` silently fell back to default mileage for everyone — a real bug we fixed). Fuel price from the active `FuelSetting`. The inputs used are snapshotted onto the session (`vehicle_type_used`, `fuel_efficiency_used`, `fuel_price_used`) so past reimbursements don't change if a vehicle/price is later updated. Runs in `stop()` + offline `sync_session`/`sync_coordinates` (idempotent). Source of mileage — don't reintroduce manual start/end-km as the primary path. External/POPS (`User`-only) riders have no `RiderAccount` → default mileage.
- **Vehicle control & approval** — the vehicle sets mileage (= reimbursement money), so it's **admin-governed**, mirroring the rider signup-approval flow. `VehicleChangeRequest` model (`apps/authentication`) + `/api/v1/auth/` endpoints: `my-vehicle`, `vehicle-change-request` (rider raises a pending request), `vehicle-change-requests/pending` and `<id>/approve|reject` (manager-gated via `_is_manager`; approve updates `RiderAccount.vehicle_type`). Frontend: day-start `VehicleConfirmModal` confirms the vehicle before a session starts (no vehicle → "Start anyway", flagged via `vehicle_type_used=None`); admin `VehicleChangeRequests` panel embedded in `AdminRiderManagement`. Don't make the vehicle freely rider-editable — keep the approval gate.
- **Web-GPS limitation** — this is a web app: `navigator.geolocation.watchPosition` only runs while the page is open & foregrounded; there is **no background GPS**. That's *why* mileage is stop-to-stop, not trail-based. True background tracking would need a native/Capacitor wrapper (analysis in `docs/route-planning-prd.html`).
- **`POST /api/v1/routes/road-path`** returns road-accurate polyline geometry for the map — keeps the routing key server-side (the frontend must NOT call public routing servers directly).

## Conventions

- **TypeScript strict mode is required.** Don't disable it. Avoid `any`.
- **Functional components only**, named exports preferred (pages may default-export).
- New API calls go through `ApiClient` — never call `fetch`/`axios` directly elsewhere.
- New data: validate with Zod on the client and DRF serializers on the server; update `shared/types.ts` / `shared/schema.ts` when the contract changes.
- Tailwind utilities only — no inline styles, CSS modules, or competing UI libraries.
- Python: 4-space indent, DRF serializers for all I/O, Django ORM (no raw SQL without a reason). Migrations are mandatory for model changes — **generate them with `makemigrations`, don't hand-write** (hand-written ones drift on index names / `id` field). If you can't run `makemigrations` locally, run it (or `makemigrations --check`) in the Django container/on the server, and commit the generated file.
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
- Routing env vars or provider — mirror into BOTH compose files; they read from `.env` (gitignored). Don't remove the `useRouteOptimization` debounce (ORS quota) or the Haversine fallbacks.
- Mileage/ETA logic (`finalize_session_metrics`, `optimize_path`) — it feeds reimbursement and customer ETAs; calibrate before trusting.
- Replacing core frameworks (React/Wouter/TanStack Query/Tailwind/Radix on the frontend; Django/DRF/Simple JWT on the backend).

## Git & GitHub workflow — MANDATORY

**Never `git commit`, `git push`, or open a pull request without explicit user confirmation.**

The required sequence for every change:
1. Make all code changes
2. Run syntax/type checks and confirm they pass
3. Show the user a clear summary: what was changed, which files, why
4. **Wait for the user to say "push it", "commit", "go ahead", or equivalent**
5. Only then stage, commit, and push

This applies to all changes — features, fixes, refactors, and documentation.
Do not combine steps 3 and 5. The summary comes first; the commit only happens after the user confirms.

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
| Routing provider abstraction | `backend/apps/shipments/routing.py` |
| Auto mileage/fuel + status service | `backend/apps/shipments/services.py` (`finalize_session_metrics`) |
| Route optimization / ETA endpoint | `optimize_path` in `backend/apps/shipments/views.py` |
| Route optimization hook (debounced) | `client/src/hooks/useRouteOptimization.ts` |
| Vehicle control model + endpoints | `backend/apps/authentication/{models,views,urls}.py` (`VehicleChangeRequest`) |
| Day-start vehicle modal | `client/src/components/routes/VehicleConfirmModal.tsx` |
| Admin vehicle approvals | `client/src/components/admin/VehicleChangeRequests.tsx` (in `AdminRiderManagement`) |
| Vehicle API client / hook | `client/src/apiClient/vehicleControl.ts`, `client/src/hooks/useMyVehicle.ts` |
| POPS inbound | `backend/apps/shipments/pops_order_receiver.py` |
| Outbound callbacks | `backend/apps/shipments/external_callback_service.py` |
| Post-save signal triggers | `backend/apps/shipments/signals.py` |
| Shared types contract | `shared/types.ts`, `shared/schema.ts` |
| Route planning PRD (recommendations) | `docs/route-planning-prd.html` |
| Prod deploy script / compose | `deploy.sh`, `docker-compose.prod.yml` |
