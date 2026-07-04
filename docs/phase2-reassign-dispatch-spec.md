# Phase 2 (Stage 2) — Review, Reassign & Dispatch · Build Spec

> **STATUS: SHIPPED & LIVE IN PRODUCTION (main `aaf4348`, 2026-07-04).** All phases 1→4c are deployed and verified. This doc is now an **as-built** record — where the plan diverged from what shipped, the shipped design wins (noted inline). See also `.claude/plans/plan-a-build-for-gentle-tarjan.md` (the phased build plan).

*Turns the read-only ops day-view (Phase 1) into an actionable control surface: ops reviews the auto-plan, resolves overlaps by **reassigning or ignoring**, then **dispatches** a rider (locks the stop order); the rider app executes the locked route. Builds directly on the Phase 1 day-plan endpoint + page.*

## Goal
Close the loop from *visibility* (Phase 1) to *action*: ops can fix a bad plan and commit it before drivers leave — with every overlap carrying a clear "reassign to whom, or ignore" decision, and a dispatched route the rider app obeys.

## Decisions baked in (PRD §10 — all resolved)
- **Reassign syncs to PIA** via the existing outbound channel (`_sync_shipment_to_pops` → `update_order_fields` / `PATCH /deliveryq/{id}/`).
- **Reassign REUSES `change-rider` / `batch-change-rider`** — **no new `/routes/reassign` endpoint** (the planned T2 was dropped; those endpoints already validate target + status, log an `assignment` OrderEvent, and sync to PIA).
- **Overlap** = same **pincode** (Phase 1 shows per-rider stop counts + a suggestion).
- **Overloaded** = estimated finish past ~8 hr shift **OR** stop-count over threshold (tunable: `OPS_SHIFT_MINUTES`, `OPS_MAX_STOPS`).
- **Waves** = plan/dispatch per **morning / noon / evening / all**.
- **Dispatch = two nullable `Shipment` fields** (`dispatch_sequence`, `dispatched_at`) — **no `RoutePlan` model** (the planned T4 was dropped as unnecessary; the locked order is just `ORDER BY dispatch_sequence`, far lower-risk).
- **Post-dispatch new order** = **delivery → un-sequenced + flagged** for ops to re-dispatch/relocate; **pickup → appended** to the dispatched rider's locked route.
- **Ignore-overlap = server-shared** (`OverlapIgnore` model, visible to all ops users).
- **Mileage** = stop-to-stop is the official figure. **Stay web.**

## The "reassign or ignore" UX
Phase 1 surfaces, per overlap: which riders, how many stops each has in the pincode, and a plain suggestion (*"B has 1 stop in 560001 vs A's 5 — move B's stop to A, or ignore if intentional"*). Stage 2 turns that into **actions**:

| Flag | What ops sees | Actions (as shipped) |
|---|---|---|
| **Pincode overlap** | The riders + stop counts + suggestion (heaviest keeper) | **[Reassign {lighter rider}'s stops in {pincode} →]** (opens the target picker) · **[Ignore / Un-ignore]** (server-shared dismissal for that date+wave; ignored rows dim) |
| **Per-stop reassign** | Each rider card lists its road-ordered stops with checkboxes (in-progress stops disabled) | **[Reassign N selected →]** (target picker, excludes the source rider) |
| **Overloaded rider** | Finish ETA / stop count vs threshold + reasons | Shown as a flag/badge (resolve via the reassign controls above) — *a dedicated "Rebalance" button was **not** built (deferred)* |
| **Unassigned shipment** | Listed with id · name · pincode | Shown as a list — *a per-item "Assign" button was **not** built (deferred)* |
| **Dispatch** | Per rider card | **[Dispatch route]** → locks the order; card shows **🔒 Dispatched HH:MM** and the button becomes **[Re-dispatch]** (confirm-gated) |

The reassign target picker warns if the move would overload the target (computed from the already-loaded day-plan — no extra fetch). After any action the day-plan refetches and flags update.

## Flow
**Auto-plan (Phase 1) → review overlaps/overload → Reassign / Ignore → Dispatch a rider (locks the order) → rider app obeys the locked route (live ETAs still refresh within it) → actual mileage auto-recorded.**

## What shipped, by phase (as-built)

### Phase 1 — Reassign from the day-view · `cb95a1c` (zero backend)
Per-stop checkboxes on each rider card + a per-overlap "reassign the lighter rider's stops" shortcut + `ReassignDialog`. **Reuses** `batch-change-rider` / `change-rider` / `available-riders` — no new endpoint. `useReassignShipments` hook toasts both updated + failed counts (an in-progress stop is rejected server-side and shown as a failure, never a silent success).

### Phase 2 — Reassign honesty + overload warning · `a102358` (small additive backend)
`change_rider` / `batch_change_rider` now capture the previously-ignored `_sync_shipment_to_pops(...)` bool and return additive `pops_synced` + `pops_sync_failed_count`; idempotency skip when target == current rider. `ReassignDialog` shows an overload warning from day-plan data + a "sync pending" toast on POPS-sync failure. Reassign still succeeds locally regardless (DB is source of truth; `needs_sync` retry handles POPS).

### Phase 3 — Server-shared "ignore overlap" · `ef4f310` (small model)
`OverlapIgnore(date, wave, pincode, created_by, created_at)` model + shipments **migration 0004**. Manager-gated `POST /routes/overlap-ignore` toggle (upsert/delete). `day_plan` marks each overlap with additive `ignored: bool` (marked, not dropped — the count stays auditable). OpsDayView Ignore/Un-ignore toggle + dimmed ignored rows.

### Phase 4a — Persist dispatch · `cc539af` (+ hotfix `0bf0935`), backend-only, dormant
Two nullable `Shipment` fields `dispatch_sequence` + `dispatched_at` + shipments **migration 0005** (nullable, no backfill → safe). Nearest-neighbour ordering factored into the shared `_road_order_indices` helper (so the dispatched order == the day-plan preview order). Manager-gated `POST /routes/dispatch {date, wave, employee_id}` writes `dispatch_sequence` 1..N + `dispatched_at`; `day_plan` reports additive `dispatched`.
**⚠️ Gotcha (fixed):** the action method must be named `dispatch_route` (with `url_path='dispatch'`), NOT `dispatch` — a DRF `@action` named `dispatch` overrides `APIView.dispatch()` and 500s the entire ViewSet. Always runtime-curl a viewset endpoint after a backend deploy (expect 401, not 500).

### Phase 4b — Rider app obeys the locked order · `c8871b1`
`shipments` action orders `F('dispatch_sequence').asc(nulls_last=True), created_at`; `ShipmentSerializer` exposes `dispatch_sequence` + `dispatched_at` (additive, read-only). `useRouteOptimization` derives a `locked` flag (all stops sequenced) → suppresses re-optimize-on-drift but still calls `optimize_path` for ETAs/map geometry. `ActiveRouteTracking` sorts by `dispatch_sequence` + shows a "Dispatched order — locked by ops" badge. **Backward-compatible + dormant** until a route is dispatched (`dispatch_sequence` NULL → `locked=false` → behaves exactly as before).

### Phase 4c — Dispatch UI + post-dispatch rules · `aaf4348`
Per-rider **Dispatch / Re-dispatch** button (re-dispatch confirm-gated) + 🔒 Dispatched badge + `dispatched_at` on the day-plan rider payload; `useDispatch` hook, `routeAPI.dispatch`, `DispatchResponse` type. Backend `_reseat_dispatch_sequence_on_reassign` (in `change_rider`/`batch_change_rider`): a reassigned stop drops its stale sequence; on a **dispatched** target a **pickup appends** (next sequence) and a **delivery** is left un-sequenced + **flagged** for ops (no auto-pick). `dispatch_route` now **preserves in-progress stops' sequences** on re-dispatch (only re-orders pending ones — no mid-route jumps). Reassign surfaces a "N deliveries need re-dispatch" toast.

## Definition of done — all met
- ✅ Overlap → **Reassign** the lighter rider's stops (or pick another target) → shipment moves rider, syncs to PIA, day-plan recomputes with the overlap cleared.
- ✅ **Ignore** dismisses an overlap server-shared (all ops users) and doesn't re-nag for that date+wave; **Un-ignore** restores.
- ✅ **Dispatch** locks a rider's route; the rider app shows the locked ordered route + ETAs and stops re-optimizing.
- ✅ Post-dispatch: a new **delivery** on a dispatched rider is un-sequenced + flagged; a new **pickup** appends; re-dispatch never re-sequences an in-progress stop.

## Deferred / still-open
- **Dispatch-all** header button — per-rider dispatch shipped; a one-click "dispatch every rider" was deferred (each dispatch is a deliberate ORS matrix call).
- **Overload "Rebalance" + Unassigned "Assign" buttons** — not built; both are resolvable today via the reassign controls, just without a dedicated one-click affordance.
- **`suggested_target_employee_id` on flags** — not a field; the UI derives the target (the overlap's lightest rider) client-side from the day-plan.
- **Reseat wave-precision** — the post-dispatch reseat uses a coarse "target has any dispatched shipment" check, not scoped to the exact wave window (safe defaults either way; a precise per-wave check is a minor refinement).
- **POPS reassign-sync reliability** — reassign rides `update_order_fields`; the ~33% "empty response" false-negative was fixed. **Monitor `sync_status` success rate** to confirm it climbs.
- **Calibrate auto-mileage** vs manual km over a few real shifts before trusting it for reimbursement; eyeball the dispatch flow + rider locked-order in the live app.
- **External / POPS riders** (no `RiderAccount`) → default mileage; extending vehicle control to them is its own future feature. Reassigning *to/away from* them works for assignment.

## Out of scope (unchanged from the PRD's non-goals)
Auto-assignment, zone grouping, batch multi-driver solving, OR-Tools (only if delivery time-windows / vehicle capacity / pickup-before-delivery precedence arrive), and native/Capacitor background GPS (deferred — stay web).
