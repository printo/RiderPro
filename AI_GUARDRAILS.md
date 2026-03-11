# AI Guardrails — RiderPro

> **Strict safety rules that AI agents must NEVER violate.**
> These rules override any other instructions. When in doubt, ask the user.

---

## CRITICAL RULES

> **Violations of these rules can break the production system.**

- **NEVER** rewrite large parts of the codebase without explicit instruction
- **NEVER** replace major frameworks (React, Django, PostgreSQL, Tailwind, Radix UI)
- **NEVER** introduce random or untested dependencies
- **NEVER** delete working modules, services, or components without confirmation
- **NEVER** modify authentication logic (JWT, token refresh, role checks) without explicit approval
- **NEVER** change database models without generating and reviewing migrations
- **NEVER** hardcode secrets, API keys, passwords, or connection strings
- **NEVER** commit `.env` files or expose sensitive configuration
- **NEVER** disable TypeScript strict mode or ESLint rules
- **NEVER** remove error handling, offline sync, or retry logic

---

## ARCHITECTURE PROTECTION

### AI must NOT:
- Restructure the repository layout
- Rename core directories (`client/`, `backend/`, `shared/`, `scripts/`)
- Move files between architectural layers (e.g., service logic into components)
- Merge or split Django apps without instruction
- Change the API base path (`/api/v1/`)
- Modify Docker or deployment configuration without approval
- Change the Vite proxy configuration
- Alter the build output structure

### AI must PRESERVE:
- The separation between `pages/`, `components/`, `hooks/`, `services/`
- The Django app boundaries (`authentication/`, `shipments/`, `vehicles/`, `routes/`, `sync/`)
- The singleton pattern for `ApiClient` and `AuthService`
- The TanStack Query caching layer
- The offline-first architecture (IndexedDB + sync queue)
- The role-based access control system
- The shared types contract in `shared/`

---

## DEPENDENCY CONTROL

### AI must:
- **Prefer existing libraries** — check `package.json` and `requirements.txt` first
- **Avoid adding new dependencies** unless the task cannot be accomplished otherwise
- **Document any dependency change** — explain why it's needed
- **Ask before installing** any package not in the approved list (see `AI_PROJECT_CONTEXT.md`)

### AI must NOT:
- Add CSS frameworks (Tailwind is the only approved one)
- Add state management libraries (TanStack Query + React Context is the pattern)
- Add routing libraries (Wouter is the router)
- Add UI component libraries (Radix UI / shadcn/ui is the system)
- Add ORMs or query builders on the frontend
- Downgrade or remove existing dependencies
- Add packages that duplicate existing functionality

---

## SAFE CODING RULES

### Minimal Changes
- Change only what is needed — do not "improve" surrounding code
- Do not add features beyond what was requested
- Do not refactor code unrelated to the task
- Do not add comments, docstrings, or type annotations to untouched code

### Style Consistency
- Match the indentation of the file (2 spaces for TS/TSX, 4 spaces for Python)
- Match the naming conventions of the directory
- Match the import ordering pattern of the file
- Use existing utility functions from `lib/utils.ts` — do not create duplicates

### Avoid Breaking Changes
- Do not change function signatures that are used by other modules
- Do not rename exported symbols without updating all consumers
- Do not change API response shapes without updating frontend types
- Do not alter database column names without a migration + serializer update
- Do not remove fields from serializers that the frontend depends on

### Security
- Never use `dangerouslySetInnerHTML` without sanitization
- Never expose user data in URLs or logs
- Never bypass JWT authentication checks
- Never use `eval()`, `Function()`, or dynamic code execution
- Never store tokens in plain text outside of the existing auth flow
- Always validate user input (Zod on frontend, serializers on backend)

---

## AI DECISION POLICY

### When uncertain, the AI MUST:
1. **Ask the user for clarification** — do not guess
2. **Explain the options** — present alternatives with trade-offs
3. **Default to the safest option** — minimal change, no new dependencies
4. **Never invent architecture decisions** — the project has established patterns

### The AI must ASK before:
- Adding any new dependency
- Creating new Django apps or models
- Changing authentication or authorization logic
- Modifying the database schema
- Changing API contracts (request/response shapes)
- Creating new architectural patterns not present in the codebase
- Deleting any file, function, or module
- Changing environment configuration or Docker setup

### The AI must NEVER assume:
- That a feature doesn't exist — search first
- That code is unused — check imports and references
- That a pattern is wrong — it may be intentional
- That refactoring is wanted — only do what was asked

---

## FILE INDEX — Quick Reference

> Use this to instantly locate the right file for any change.

### Frontend Entry Points
| What | File |
|------|------|
| App routing + auth gate | `client/src/App.tsx` |
| Vite entry + PWA | `client/src/main.tsx` |
| Global styles + CSS vars | `client/src/index.css` |
| API endpoint map | `client/src/config/api.ts` |
| Query client config | `client/src/lib/queryClient.ts` |
| Role helpers | `client/src/lib/roles.ts` |
| General utilities | `client/src/lib/utils.ts` |

### Core Services
| What | File |
|------|------|
| HTTP client (singleton) | `client/src/services/ApiClient.ts` |
| Auth management | `client/src/services/AuthService.ts` |
| GPS tracking | `client/src/services/GPSTracker.ts` |
| Route sessions | `client/src/services/RouteSession.ts` |
| Offline storage | `client/src/services/OfflineStorageService.ts` |
| Error handling | `client/src/services/ErrorHandlingService.ts` |
| Data export | `client/src/services/DataExporter.ts` |
| Fuel calculations | `client/src/services/FuelCalculator.ts` |

### Backend Entry Points
| What | File |
|------|------|
| Django settings | `backend/riderpro/settings.py` |
| URL routing root | `backend/riderpro/urls.py` |
| User model | `backend/apps/authentication/models.py` |
| Auth views | `backend/apps/authentication/views.py` |
| Shipment model | `backend/apps/shipments/models.py` |
| Shipment views | `backend/apps/shipments/views.py` |
| Shipment serializers | `backend/apps/shipments/serializers.py` |
| Analytics endpoints | `backend/apps/shipments/analytics_views.py` |
| External callbacks | `backend/apps/shipments/external_callback_service.py` |
| POPS integration | `backend/apps/shipments/pops_order_receiver.py` |
| Vehicle models | `backend/apps/vehicles/models.py` |
| Route models | `backend/apps/routes/models.py` |

### Shared Contracts
| What | File |
|------|------|
| TypeScript types | `shared/types.ts` |
| Zod schemas + interfaces | `shared/schema.ts` |
| Sync status enums | `shared/syncStatus.ts` |

### Configuration
| What | File |
|------|------|
| TypeScript config | `tsconfig.json` |
| Vite build + proxy | `vite.config.ts` |
| Tailwind theme | `tailwind.config.ts` |
| ESLint rules | `eslint.config.js` |
| Docker services | `docker-compose.yml` |
| Env template | `.env.example` |
| Python deps | `backend/requirements.txt` |
| Node deps | `package.json` |

---

## Summary

```
STOP and ASK if you are about to:
  ✗ Add a dependency
  ✗ Change auth logic
  ✗ Modify database schema
  ✗ Delete any module
  ✗ Change API contracts
  ✗ Restructure directories

ALWAYS:
  ✓ Read files before modifying
  ✓ Make minimal changes
  ✓ Follow existing patterns
  ✓ Preserve architecture boundaries
  ✓ Run type check + lint
```
