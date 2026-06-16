# Phase 1 — Ops Day-View (read-only) · Build Spec

*Build-ready breakdown of the first planning increment. Decisions from the PRD §10 are baked in. **Read-only** — no writes, no reassignment, no dispatch (those are Stage 2).*

## Goal
A manager-only ops screen that shows, for a chosen **date + wave**, every working rider's **auto-ordered route** (pickups + deliveries), **totals** (stop count, total km, finish ETA), and **problem flags** (overlap, overload, unassigned, unmappable) — *before* drivers leave. Pure visibility; reuses the live optimizer.

## Decisions baked in (from PRD §10)
- **Overlap** = two riders with stops in the **same pincode** (decision 2).
- **Overloaded** = estimated finish past the **~8 hr shift** *OR* **stop count over a threshold** (decision 4); both thresholds in settings, tunable.
- **Waves** = rolling; the view filters by **wave (morning / noon / evening)** (decision 3).
- **Manager-gated** (super_user / ops_team / staff).
- Reuses `optimize_path`; **no new routing**, no schema change.

## Data contract — `GET /api/v1/routes/day-plan?date=YYYY-MM-DD&wave=<morning|noon|evening|all>`
```jsonc
{
  "date": "2026-06-16", "wave": "morning", "generated_at": "…",
  "riders": [{
    "employee_id": "R123", "rider_name": "…",
    "vehicle": {"type": "Bike", "fuel_efficiency": 45},
    "stops": [{
      "shipment_id": 1, "type": "delivery", "sequence": 1,
      "address": "…", "pincode": "560001", "lat": 12.9, "lng": 77.6,
      "status": "assigned", "eta_minutes": 12, "eta_clock": "09:42",
      "distance_from_previous_km": 4.2
    }],
    "totals": {"stop_count": 8, "total_km": 31.4, "est_duration_min": 246, "finish_eta_clock": "13:06"},
    "flags": {"overloaded": false, "reasons": []}
  }],
  "unassigned": [{ "shipment_id": 9, "address": "…" }],
  "unmappable": [{ "shipment_id": 12, "address": "…" }],
  "overlaps": [{ "pincode": "560001", "rider_ids": ["R123", "R456"] }]
}
```

## Tickets (bottom-up — repo's full-stack workflow)

### Backend
- **T1 · Day-plan service** — given `date` (+ optional `wave`), gather working riders and their assigned shipments for that date; per rider, run the existing optimizer to get ordered stops + per-stop ETAs + totals; compute flags.
  - *AC:* returns ordered stops + totals per rider; **overlap** = riders sharing a pincode; **overload** = finish-past-shift **or** stop-count over threshold; `unassigned` (no rider) and `unmappable` (no lat/lng) buckets populated. No DB writes.
- **T2 · Serializer(s)** — DRF serializer(s) for the response contract above.
- **T3 · Endpoint** — `GET /api/v1/routes/day-plan` (action on `RouteSessionViewSet`), **manager-gated**; params `date` (default today), `wave` (default all).
  - *AC:* 200 with the contract; **403** for non-managers; default date = today; invalid date → 400.
- **T4 · Wiring** — register URL; add types to `shared/types.ts` + `shared/schema.ts`.

### Frontend
- **T5 · Client wiring** — `routes.dayPlan` in `client/src/config/api.ts`; service method via `ApiClient`; `useDayPlan(date, wave)` hook (TanStack Query).
- **T6 · Page** — `OpsDayView.tsx`, manager-gated route in `App.tsx`: date picker + wave filter; per-rider cards (ordered stops, totals, finish ETA, **flag badges**); an **unassigned / unmappable** panel; an **overlaps** callout. Reuse existing map + stop-list components where possible.
  - *AC:* ops opens today's plan and sees every rider's ordered route + totals + ETAs + flags; pincode overlaps highlighted; **read-only**.
- **T7 · Nav** — manager-only nav entry to the page.

## Out of scope (Stage 2+)
Reassignment, suggestions, route lock, dispatch — any write. This phase is read-only oversight only.

## Definition of done
Given a manager opens the day-view for a date/wave, **when** the page loads, **then** every working rider shows their ordered route (pickups + deliveries), total km, finish ETA, and overload/overlap/unassigned/unmappable flags — with zero writes to shipments, and non-managers get 403.
