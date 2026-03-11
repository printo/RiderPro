# Task Rules — RiderPro

> Rules and workflows AI assistants MUST follow when implementing tasks.

---

## Before You Start Any Task

- [ ] Read `AI_PROJECT_CONTEXT.md` for tech stack and standards
- [ ] Read `ARCHITECTURE.md` for structure and boundaries
- [ ] Read `AI_GUARDRAILS.md` for safety constraints
- [ ] Read the specific files you plan to modify
- [ ] Identify which layer the change belongs to (page, component, hook, service, API, model, view)

---

## Code Editing Rules

### General
1. **Read before writing** — Never modify a file you haven't read
2. **Minimal diff** — Change only the lines necessary to accomplish the task
3. **One concern per change** — Don't fix unrelated issues in the same edit
4. **Preserve formatting** — Match the indentation, spacing, and style of surrounding code
5. **No dead code** — Don't leave commented-out code, unused imports, or orphaned functions

### TypeScript / React
- Use existing path aliases: `@/` for `client/src/`, `@shared/` for `shared/`
- Use existing shadcn/ui components from `components/ui/` — check before creating new ones
- Use Tailwind utility classes — no inline styles, no CSS modules, no styled-components
- Use Zod schemas for any new data validation
- Use React Hook Form for any new forms
- Use TanStack Query (`useQuery` / `useMutation`) for any new API calls
- Prefer `const` over `let`; never use `var`
- Use existing type definitions from `shared/types.ts` and `shared/schema.ts`

### Python / Django
- Use DRF serializers for all API I/O — no manual JSON construction in views
- Use Django ORM — no raw SQL unless explicitly approved
- Add new endpoints to the correct app's `urls.py` and register in `riderpro/urls.py`
- Use existing model fields before adding new ones
- Create Django migrations for any model changes: `python manage.py makemigrations`

---

## Feature Implementation Workflow

### Step 1: Locate
- Identify which files need changes using `ARCHITECTURE.md`
- Check if similar functionality already exists — reuse it

### Step 2: Plan
- List the files to modify (frontend + backend if full-stack)
- Identify shared types that need updating (`shared/types.ts`, `shared/schema.ts`)
- Determine if new API endpoints are needed

### Step 3: Implement (Backend First)
For full-stack features, work bottom-up:
1. **Model** — Add/modify fields in the Django model
2. **Migration** — Generate and review migration
3. **Serializer** — Update request/response formatting
4. **View** — Add/modify the API endpoint
5. **URL** — Register the route
6. **Shared types** — Update `shared/types.ts` if the data contract changes
7. **Frontend service/hook** — Add API call wrapper
8. **Component/Page** — Build or modify the UI

### Step 4: Verify
- Run `npm run check` — TypeScript must pass
- Run `npm run lint` — ESLint must pass
- Test the feature manually if possible

---

## Refactoring Constraints

- **Do not refactor code unrelated to the current task**
- **Do not rename files or directories** without explicit instruction
- **Do not change import paths** across the codebase unless fixing a bug
- **Do not convert patterns** (e.g., class → function, callback → promise) unless asked
- **Do not add type annotations** to files you didn't otherwise modify
- **Do not reorganize folder structure** — see `AI_GUARDRAILS.md`

---

## Safe Modification Guidelines

### Adding a New Page
1. Create the page component in `client/src/pages/`
2. Add the route in `client/src/App.tsx` following existing patterns
3. Add navigation link in `client/src/components/Navigation.tsx` if needed
4. Gate with role check if the page is restricted

### Adding a New Component
1. Check `components/ui/` for existing primitives first
2. Place in the correct domain folder (`components/shipments/`, `components/routes/`, etc.)
3. If it's generic and reusable across domains, place in `components/`
4. Keep it stateless if possible — pass data via props

### Adding a New Hook
1. Place in `client/src/hooks/`
2. Name with `use` prefix: `useMyFeature.ts`
3. Wrap service calls and return React-friendly state
4. Use TanStack Query for any data fetching

### Adding a New Service
1. Place in `client/src/services/`
2. Use singleton pattern if the service manages state
3. Use the existing `ApiClient` for HTTP calls — never use `fetch` or `axios` directly
4. Handle errors using `ErrorHandlingService` patterns

### Adding a New API Endpoint (Backend)
1. Add view in the correct app's `views.py` (or create a separate views file if complex)
2. Add serializer in `serializers.py`
3. Register URL in the app's `urls.py`
4. Add endpoint constant in `client/src/config/api.ts`
5. Update `shared/types.ts` if new response types are needed

### Modifying a Database Model
1. Add/modify fields in `models.py`
2. Run `python manage.py makemigrations`
3. Review the generated migration file
4. Update serializers to include new fields
5. Update `shared/schema.ts` and `shared/types.ts` to reflect changes

---

## Dependency Management Rules

### Adding a Frontend Dependency
1. Check if existing libraries can solve the problem
2. Check `AI_PROJECT_CONTEXT.md` approved list
3. If not approved, **ask the user before installing**
4. Prefer small, well-maintained packages
5. Never add competing libraries (e.g., don't add Material UI alongside Radix UI)

### Adding a Backend Dependency
1. Check if Django/DRF built-ins can solve the problem
2. Check `requirements.txt` for existing packages
3. If new, **ask the user before adding**
4. Pin the version in `requirements.txt`

### Forbidden Dependency Actions
- Never replace Wouter with React Router
- Never replace TanStack Query with SWR or Redux
- Never replace Tailwind with another CSS framework
- Never replace Django REST Framework with another API framework
- Never add an ORM on top of Django ORM

---

## File Creation Rules

- **Prefer editing existing files** over creating new ones
- New files must follow the naming convention of their directory
- New components: `PascalCase.tsx`
- New hooks: `useCamelCase.ts`
- New services: `PascalCase.ts`
- New Django files: `snake_case.py`
- Never create files outside the established directory structure
- Never create duplicate utility files — check `lib/utils.ts` first

---

## Documentation Update Rules

- Update `CHANGES.md` for user-facing features and significant bug fixes
- Update `api-documentation.md` when API endpoints change
- Update `shared/types.ts` when data contracts change
- Do **not** create new documentation files unless explicitly requested
- Do **not** add inline JSDoc/docstrings to files you didn't modify
- Keep comments minimal — code should be self-explanatory

---

## Checklist Before Submitting Changes

- [ ] Only modified files relevant to the task
- [ ] No new dependencies added without approval
- [ ] TypeScript strict mode passes (`npm run check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Existing functionality is not broken
- [ ] Shared types updated if data contracts changed
- [ ] API endpoint registered in `config/api.ts` if new
- [ ] Follows the coding style of surrounding code
