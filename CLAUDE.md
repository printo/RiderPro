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
- **A push to `main` appears to auto-deploy the backend** — `riderpro-django` recreates within seconds of a push — **but NOT the frontend.** A frontend (or BE+FE-coupled) change needs an explicit `./deploy.sh frontend`; always verify `riderpro-frontend` shows a fresh `Up Xs` afterward (it can silently stay stale). And runtime-curl a viewset endpoint post-deploy (expect **401, not 500**) — `manage.py check`/`py_compile` don't catch a DRF method-name override that 500s the whole ViewSet.
- `both` mode runs `docker system prune -f --volumes` — prefer `backend`/`frontend` for routine deploys to avoid it.
- Production env (incl. routing keys) is in `.env` on the server (gitignored). A container must be **recreated** (not just restarted) to pick up `.env` changes.
- **Any new `${VAR}` used in compose must be added to BOTH `docker-compose.yml` and `docker-compose.prod.yml`** (the prod file is a separate, standalone config).
- **Production nginx** is host-level at `/etc/nginx/conf.d/riderpro.conf` (Certbot-managed TLS), mirrored in the repo at `nginx/conf.d/riderpro.conf`. It routes `/api/`, `/admin/`, `/static/`, `/media/`, `/health` → Django (`:8004`) and everything else → the SPA (`:5004`, `serve -s`). **The Django-admin location MUST be `location ^~ /admin/` (trailing slash)** — a greedy `^~ /admin` (no slash) also swallows SPA routes like `/admin-dashboard` and `/admin-riders` and gives a Django 404 on hard-refresh (in-app nav still works since it's client-side). `deploy.sh` runs a post-deploy smoke test for this, and `SYNC_NGINX=1 ./deploy.sh …` pushes the repo nginx config to the server (`nginx -t` + auto-rollback). It does **not** sync nginx by default — the live config carries Certbot SSL, so keep the repo copy in sync manually if you re-run `certbot --nginx`.
- **Prod runs `DEBUG=False`**, set in the server's gitignored `backend/riderpro/localsettings.py`, which `settings.py` imports **last** (so it overrides the env-driven boot defaults). `settings.py` boots without `localsettings.py` using dev defaults; `localsettings.example.py` documents the structure. Keep `DEBUG=False` on prod — a debug error page leaks the URLconf/settings. `localsettings.py` also holds `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS`, DB creds, and `RIDER_PRO_API_KEYS`.

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
- **Inbound**: `POST /api/v1/shipments/receive` (alias `/webhooks/receive-order`) accepts batch payloads, authenticated by `x-api-key` or `Authorization: Bearer <jwt>`. API keys configured in `backend/riderpro/localsettings.py` as `RIDER_PRO_API_KEYS` — a **dict keyed by source name** (`{"pops": {"key", "callback_url", "active", "auth_header"?}}`); the source name becomes `Shipment.api_source` and routes the outbound callback. (A list of entries is tolerated for backwards-compat via `get_api_key_configs()`, but the dict is canonical.) **POPS/PIA authenticates with `x-api-key`, NOT a JWT — this is deliberate: rotating `SECRET_KEY` invalidates any externally-held JWT** (PIA's old "lifetime service JWT" broke on a `SECRET_KEY` rotation with *"Given token not valid for any token type"*), whereas `x-api-key` is independent of `SECRET_KEY`. PIA stores the same value as `RIDER_PRO_API_KEY` and sends it from `SendOrdersToRiderProView` (the `printo/pops` repo). **Rule: never use a `SECRET_KEY`-signed JWT for service-to-service auth.**
- **Outbound** — two independent paths, both currently dormant/broken:
  - *Custom callbacks*: status changes trigger `post_save` signals → `external_callback_service.py` POSTs to the integration's `callback_url`. **Not in use** — PIA has no receiver endpoint, so `callback_url` is empty (the callback no-ops with a "No callback URL" warning).
  - *POPS status sync*: `ShipmentStatusService._sync_to_pops` → `pops_client.update_order_status` → POPS `/deliveryq/status-update/`, auth'd by RiderPro's own `RIDER_PRO_SERVICE_TOKEN`. **Known-broken, pre-existing (0 ok / 1581 failed lifetime)** — that POPS endpoint (`StatusUpdateLocusView`, a Locus-courier callback) requires `HasOrderUpdatePermission` (the service account lacks it → 403) AND expects a nested `{"order": {"id": "..._<pk>", "orderStatus": ...}}` payload while RiderPro sends flat `{"id","status"}` → 400. Fixing needs POPS-side changes; the token itself is valid (token-verify 200, not expired).

### Auth & roles

- JWT (Simple JWT) with cookie + Authorization-header support; custom User model in `apps.authentication`.
- **Two live login paths** (the old password signup/login is retired — see below):
  - **Riders: phone + OTP (passwordless).** `LoginForm` collects a phone, `POST /api/v1/auth/request-otp` sends a 6-digit code over WhatsApp, `POST /api/v1/auth/verify-otp` checks it and issues JWTs (auto-creating the Django `User` from the matched `RiderAccount`). Both endpoints are `AllowAny` and deliberately give the **same response whether or not a rider matched**, so they can't be used to enumerate registered numbers.
  - **Staff/admins: Google SSO** (see below).
- Roles: super_user, ops_team, staff, driver, viewer. Backend filters queries by `employee_id` for drivers; frontend gates UI via `client/src/lib/roles.ts` helpers (`isManagerUser`, etc.).
- **Google SSO** — "Continue with Google" on the login page. `google_login` (`apps/authentication/views.py`) verifies the Google `id_token`'s `aud` against `GOOGLE_OAUTH_CLIENT_ID`, then **delegates the access decision to POPS/PIA**: the token is forwarded to POPS's own Google login (`pops_client.login_with_google` → `/api/v1/auth/google/login/`); if POPS accepts (Google account linked + ACTIVE there), the local `User` is auto-provisioned/updated via `RiderProAuthBackend._get_or_create_user_from_pops` — **role + flags are re-derived from the POPS flags and OVERWRITTEN on every login** (superuser→admin, ops_team/staff→manager, deliveryq→driver, else viewer; Django `is_staff`/`is_superuser` are NEVER granted from the external response), and POPS session tokens are stored. If POPS denies → 403 with POPS's message; POPS unreachable → known users log in with last-synced role, unknown users get 503. **Do not manually create staff users** — access is granted by linking the Google account in PIA. Emails in `GOOGLE_ADMIN_EMAILS` bypass POPS entirely and are bootstrapped as admins on first login (lockout escape hatch). Note PIA's Google verifier checks only `hd == printo.in` (no audience pin), so RiderPro-audience tokens are accepted. The client ID is public-by-design (frontend reads `VITE_GOOGLE_CLIENT_ID`, backend `GOOGLE_OAUTH_CLIENT_ID`, both with a baked default). No client *secret* is used — the backend only verifies the id_token. **Two setup gotchas (both bit us):** (1) every serving origin (`http://localhost:5004` dev, `https://riderpro.printo.in` prod) must be an **Authorized JavaScript origin** on that *exact* OAuth client in Google Cloud Console, and the code's client ID must be that same client — otherwise Google blocks the button; (2) `GOOGLE_ADMIN_EMAILS` is **empty by default** and lives in `localsettings.py` (a Python list) or the `GOOGLE_ADMIN_EMAILS` env var (comma-separated) — set it per environment or nobody can bootstrap as admin (existing users still log in with their current role).
- **Rider OTP delivery** — the OTP engine is split for channel-agnosticism: `otp_service.py` (`OtpService`) owns generation/bcrypt-hashing/expiry/rate-limiting/verification; delivery is delegated to a pluggable sender (`otp_providers.py`, selected by `OTP_PROVIDER` — `botspace` for prod WhatsApp, `console` logs the code in dev). Codes are stored only as bcrypt hashes (`OtpChallenge`), TTL `OTP_TTL_SECONDS` (default 300s), with resend cooldown + per-phone/day + per-IP/hour abuse caps (all `OTP_*` settings). **Botspace gotcha:** the WhatsApp API requires the phone in E.164 form with a leading `+` and country code (e.g. `+919940117071`); rider phones are stored as bare 10 digits, so the Botspace sender normalizes to `+<cc><number>` (default cc `91`, overridable via `OTP_DEFAULT_COUNTRY_CODE`) — sending bare 10 digits 400s with *"Invalid phone number"*. The Botspace host is `public-api.bot.space` (NOT `api.botspace.co`); config is `BOTSPACE_API_BASE/_API_KEY/_CHANNEL_ID/_OTP_TEMPLATE` in `.env`/`localsettings.py`.
- **No self-signup.** The old unauthenticated `/signup` page (`RiderSignupForm`) and password register/login are **retired** — riders are provisioned by **POPS sync** (`/api/v1/auth/riders/sync`, manager-gated) into `RiderAccount`, and rider removal is a **soft-archive** (`archived_at`). A rider must be approved + active + non-archived to receive an OTP. Vehicle is still confirmed *after* login at day-start via `VehicleConfirmModal` (admin-approved — see **Routing, mileage & ETAs → Vehicle control**). `homebase_list` GET stays `AllowAny` (POST/writes manager-gated); don't send an `Authorization` header when there's no token — an invalid `Bearer null` 401s even against `AllowAny` endpoints.

### Offline-first frontend

`OfflineStorageService` queues failed requests + GPS coords in IndexedDB. `ApiClient` retries with exponential backoff and falls back to the queue. Server is the source of truth on conflict. Do not remove retry or offline-queue logic.

### Routing, mileage & ETAs

- **Pluggable routing provider** — `backend/apps/shipments/routing.py`. `get_routing_backend()` picks a backend by the `ROUTING_PROVIDER` env var: `ors` (OpenRouteService, **default**), `google`, `osrm`, or `haversine`. Every backend **falls back to straight-line Haversine** if its service is unreachable, so routing never hard-fails. Config lives in `.env` (gitignored): `ORS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `OSRM_BASE_URL`, `ROUTING_AVERAGE_SPEED_KMH`, `ROUTING_STOP_SERVICE_SECONDS`. **Mirror any new routing env var into BOTH `docker-compose.yml` and `docker-compose.prod.yml`.**
- **Optimization** — `POST /api/v1/routes/optimize_path` orders a rider's stops by real road travel time (nearest-neighbour). Returns per-stop `eta_minutes`, absolute `eta_clock`, `distance_from_previous_km`, and route totals. ETAs add a per-stop service/dwell allowance (`ROUTING_STOP_SERVICE_SECONDS`, default 180s). The hook `useRouteOptimization` re-optimizes as the rider moves but is **debounced** (re-optimize on stop-count change, else only after moving ≥200 m AND ≥60 s) to protect the ORS free-tier quota — keep that debounce.
- **Auto mileage & fuel** — `finalize_session_metrics()` in `apps/shipments/services.py` computes a session's distance as the **road distance between confirmed pickup/delivery stops** (robust to web-app GPS gaps), falling back to the filtered GPS trail only when there are no confirmed stops. The rider's mileage/fuel-type come from **`RiderAccount.vehicle_type`** — the vehicle lives on `RiderAccount` (keyed by `rider_id`, which equals the session's `employee_id`/username), **NOT** the auth `User` (querying `User` silently fell back to default mileage for everyone — a real bug we fixed). Fuel price from the active `FuelSetting`. The inputs used are snapshotted onto the session (`vehicle_type_used`, `fuel_efficiency_used`, `fuel_price_used`) so past reimbursements don't change if a vehicle/price is later updated. Runs in `stop()` + offline `sync_session`/`sync_coordinates` (idempotent). Source of mileage — don't reintroduce manual start/end-km as the primary path. External/POPS (`User`-only) riders have no `RiderAccount` → default mileage.
- **Vehicle control & approval** — the vehicle sets mileage (= reimbursement money), so it's **admin-governed**, mirroring the rider signup-approval flow. `VehicleChangeRequest` model (`apps/authentication`) + `/api/v1/auth/` endpoints: `my-vehicle`, `vehicle-change-request` (rider raises a pending request), `vehicle-change-requests/pending` and `<id>/approve|reject` (manager-gated via `_is_manager`; approve updates `RiderAccount.vehicle_type`). Frontend: day-start `VehicleConfirmModal` confirms the vehicle before a session starts (no vehicle → "Start anyway", flagged via `vehicle_type_used=None`); admin `VehicleChangeRequests` panel embedded in `AdminRiderManagement`. Don't make the vehicle freely rider-editable — keep the approval gate.
- **Web-GPS limitation** — this is a web app: `navigator.geolocation.watchPosition` only runs while the page is open & foregrounded; there is **no background GPS**. That's *why* mileage is stop-to-stop, not trail-based. True background tracking would need a native/Capacitor wrapper (analysis in `docs/route-planning-prd.html`).
- **`POST /api/v1/routes/road-path`** returns road-accurate polyline geometry for the map — keeps the routing key server-side (the frontend must NOT call public routing servers directly).
- **Ops day-view — review / reassign / ignore (Stage 2, LIVE).** Manager-gated `GET /api/v1/routes/day-plan?date=&wave=` returns every rider's road-ordered route, ETAs, overload flags + pincode **overlaps** (read-only). Page: `OpsDayView` (`/ops-day-view`). **Reassign REUSES `change-rider` / `batch-change-rider`** — there is **no `/routes/reassign` endpoint**. `POST /api/v1/routes/overlap-ignore {date,wave,pincode,ignored}` toggles a server-shared `OverlapIgnore` (visible to all ops). Ordering uses the shared `_road_order_indices` helper so the preview == the dispatched order.
- **Dispatch — the ops-locked order (Stage 2, LIVE).** Manager-gated `POST /api/v1/routes/dispatch {date,wave,employee_id}` writes two nullable `Shipment` fields, `dispatch_sequence` (1..N) + `dispatched_at`, onto that rider's mapped in-window stops (**no `RoutePlan` model** — the design was deliberately kept to two fields; locked order = `ORDER BY dispatch_sequence`). The rider app then **obeys** it: the `shipments` action sorts `dispatch_sequence` nulls-last, and `useRouteOptimization` sets a `locked` flag that suppresses re-optimize-on-drift (still calls `optimize_path` for ETAs/geometry). Post-dispatch reassign (`_reseat_dispatch_sequence_on_reassign`): a moved **pickup appends**, a moved **delivery** is un-sequenced + **flagged** for ops; re-dispatch **preserves in-progress stops' sequences**. **GOTCHA: the DRF `@action` MUST be named `dispatch_route` with `url_path='dispatch'` — a method literally named `dispatch` overrides `APIView.dispatch()` and 500s the ENTIRE ViewSet** (it did, in prod; caught by post-deploy curl). Backward-compatible + dormant until a route is dispatched (all `dispatch_sequence` NULL → `locked=false` → rider view unchanged). Full as-built record: `docs/phase2-reassign-dispatch-spec.md`.

## Conventions

- **TypeScript strict mode is required.** Don't disable it. Avoid `any`.
- **Functional components only**, named exports preferred (pages may default-export).
- New API calls go through `ApiClient` — never call `fetch`/`axios` directly elsewhere. The `AuthService.syncRiders/syncHomebases` methods were a historical exception that caused a 401 bug (they read from `localStorage` instead of in-memory state, bypassed token refresh, and were swapped to `apiRequest` in June 2026). Use `apiRequest` or `apiClient.post/get` for all calls.
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

## Deferred cleanup — dead code after the POPS + OTP cutover

Now that riders are POPS-sourced + phone/OTP and staff use Google SSO, the items below are vestigial. The **data** cleanup is **done** (see *Legacy-user data cleanup* below); the **dead-code** items remain — fold them into a cleanup pass. **Verify each is truly unused before removing.**

**Backend endpoints with no live caller** (admin UI no longer calls them; safe to prune):
- `reset_password` (`POST /auth/reset-password/<id>`) — reset-password UI removed; nobody has a local password anymore.
- `approve_user` / `reject_user` / `pending_approvals` (`/auth/approve|reject/<id>`, `/auth/pending-approvals`) — approval UI removed; riders are pre-approved by the POPS rider sync.
- `get_user` GET (`GET /auth/users/<id>`) — Edit removed, no frontend caller (kept only for possible external/Node-compat callers; the PATCH/PUT update handler was already removed).
- `register`, `login`, `local_login` — already `410` stubs (self-signup + password login retired).

**Vestigial fields / logic:**
- `RiderAccount.password_hash` (`models.py`) + the bcrypt password branch in `backends.py` + `reset_password` — unused now that auth is OTP / Google SSO. Removing needs a migration plus cleaning `backends.py` and the serializer `create`.
- `is_approved` field + the OTP-login guard in `request_otp`/`verify_otp` — kept as a no-op safety net (synced riders are always approved; overlaps with `is_active` + `archived_at`). Drop only together with approve/reject/pending.

**Dead frontend methods:** `AuthService.loginWithExternalAPI` / `loginWithLocalDB` + their `useAuth` bindings — old password login; `LoginForm` now uses OTP + Google SSO only.

`AuthService.syncRiders()` / `syncHomebases()` — these exist but are **no longer called** (as of 2026-06-27). They used raw `fetch` + `localStorage.getItem('access_token')`, bypassing `ApiClient` token refresh and in-memory state. The `/user-management` page (which took over sync buttons from `AdminRiderManagement`) now calls `apiRequest('POST', API_ENDPOINTS.auth.syncRiders|syncHomebases)` directly, which routes through `ApiClient`. The stale `AuthService` methods can be pruned in a cleanup pass. **Rule reinforced: never call `fetch` directly — always use `ApiClient` (via `apiRequest` or `apiClient.post/get`).**

**Legacy-user data cleanup — DONE (2026-06-24), via `purge_legacy_users`.** The auth DB is now fully POPS-aligned: every `RiderAccount` is backed by a current POPS rider, and every `User` is a Google-SSO/email staff account or a live-POPS rider shadow (zero strays). Removed PIA-login shadows `10047`, `12180` (its rider-test history reassigned to the **rider** account `Kannan_rider_test`, NOT the manager), `12523`, `12592`; consolidated the Seshagiri duplicate (`Sheshagiri_300099` + `30009` → one `Seshagiri_300099` owning all its shipments/acks/route history).

The tool — `backend/apps/authentication/management/commands/purge_legacy_users.py`:
- **Dry-run by default**; `--apply` wraps changes in a transaction. Reassigns string-keyed history (`employee_id` on RouteSession/RouteTracking/Shipment/…) to the canonical record, re-verifies **zero** remaining links, then deletes. **Refuses all deletes unless the POPS rider pull is healthy** (succeeded + ≥ `--min-pops-riders`) — so "not in POPS" is never acted on off a truncated pull.
- Flags: `--map STALE=CANONICAL` (reassign history + dedup), `--rename OLD=NEW` (align a `rider_id` to POPS — **POPS-authoritative**: NEW must equal what POPS calls OLD's `pops_rider_id`), `--delete-orphan-shadow` (dead no-canonical staff shadow), `--archive-rider` (soft-archive a rider whose POPS id is gone), `--delete-history-for`, `--delete-riders`, `--pops-json`.
- **Rule learned:** rider history must NEVER merge into a manager/staff account (Kanna has dual manager+rider identities); size a merge by ALL string refs incl `Shipment.employee_id`, not just route GPS.

**Still open — POPS-side only (RiderPro can't dedupe upstream; fix in POPS, then re-sync):**
- Duplicate `rider_id`s in POPS: `11718` (×3, pops 87/88/89, "Ramjan Khan") and `Others` (×5, pops 72/75/76/77/94, placeholder).
- POPS riders with **no phone** (can't receive OTP): `Raghu_86572`, `Ramesh_48691`, `Seshagiri_300099`, `printo_prathap`, `printo_raja`.
- **`sync` does NOT auto-clean** — `sync_riders_from_pops` is upsert-only (no prune); a deleted-in-POPS rider lingers locally, and a stale name collision makes the survivor's sync silently `failed`. Use the command. Future feature spec: `docs/reconcile-on-sync-prd.html`.

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
| Ops day-view page (Stage 2) | `client/src/pages/OpsDayView.tsx` (`/ops-day-view`) |
| Day-plan / dispatch / overlap-ignore endpoints | `day_plan`, `dispatch_route`, `overlap_ignore` in `backend/apps/shipments/views.py` |
| Reassign / dispatch UI + hooks | `client/src/components/ops/ReassignDialog.tsx`; `client/src/hooks/{useDayPlan,useReassignShipments,useOverlapIgnore,useDispatch}.ts` |
| Stage 2 build spec (as-built) | `docs/phase2-reassign-dispatch-spec.md` |
| Vehicle control model + endpoints | `backend/apps/authentication/{models,views,urls}.py` (`VehicleChangeRequest`) |
| Day-start vehicle modal | `client/src/components/routes/VehicleConfirmModal.tsx` |
| Admin vehicle approvals | `client/src/components/admin/VehicleChangeRequests.tsx` (in `AdminRiderManagement`) |
| Vehicle API client / hook | `client/src/apiClient/vehicleControl.ts`, `client/src/hooks/useMyVehicle.ts` |
| POPS inbound | `backend/apps/shipments/pops_order_receiver.py` |
| Outbound callbacks | `backend/apps/shipments/external_callback_service.py` |
| Post-save signal triggers | `backend/apps/shipments/signals.py` |
| Shared types contract | `shared/types.ts`, `shared/schema.ts` |
| Route planning PRD (recommendations) | `docs/route-planning-prd.html` |
| Legacy-user cleanup command | `backend/apps/authentication/management/commands/purge_legacy_users.py` |
| Reconcile-on-sync PRD (proposed) | `docs/reconcile-on-sync-prd.html` |
| Prod deploy script / compose | `deploy.sh`, `docker-compose.prod.yml` |
| Production nginx config (mirrors live) | `nginx/conf.d/riderpro.conf` |
| Login page (rider OTP + Google SSO) | `client/src/components/LoginForm.tsx` |
| Rider OTP request/verify views | `request_otp` / `verify_otp` in `backend/apps/authentication/views.py` |
| OTP engine (gen/hash/verify/rate-limit) | `backend/apps/authentication/otp_service.py` |
| OTP delivery senders (Botspace/console) | `backend/apps/authentication/otp_providers.py` |
| Google SSO login view | `google_login` in `backend/apps/authentication/views.py` |
| Local settings template (prod overrides) | `backend/riderpro/localsettings.example.py` |
