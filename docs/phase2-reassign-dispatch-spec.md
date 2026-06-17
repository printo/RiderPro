# Phase 2 (Stage 2) — Review, Reassign & Dispatch · Build Spec

*Turns the read-only ops day-view (Phase 1) into an actionable control surface: ops reviews the auto-plan, resolves overlaps/overloads by **reassigning or ignoring**, then **locks & dispatches**; riders execute the locked route. Builds directly on the Phase 1 day-plan endpoint + page.*

## Goal
Close the loop from *visibility* (Phase 1) to *action*: ops can fix a bad plan and commit it before drivers leave — with every flag carrying a clear "reassign to whom, or ignore" decision.

## Decisions baked in (PRD §10 — all resolved)
- **Reassign syncs to PIA** via the existing outbound channel (now consolidated onto `update_order_fields` / `PATCH /deliveryq/{id}/`).
- **Overlap** = same **pincode** (Phase 1 already shows per-rider stop counts + a suggestion).
- **Overloaded** = estimated finish past ~8 hr shift **OR** stop-count over threshold (tunable).
- **Waves** = plan/dispatch per **morning / noon / evening**.
- **Post-dispatch new order** = **delivery → reassign** to another rider; **pickup → keep** on the dispatched rider.
- **Mileage** = stop-to-stop is the official figure.
- **Stay web.**

## The "reassign or ignore" UX *(the core clarity ask)*
Phase 1 already surfaces, per overlap: which riders, how many stops each has in the pincode, and a plain suggestion (*"B has 1 stop in 560001 vs A's 5 — move B's stop to A, or ignore if intentional"*). Stage 2 turns every flag into a **decision with two buttons**:

| Flag | What ops sees | Actions |
|---|---|---|
| **Pincode overlap** | The riders + stop counts + suggested keeper (heaviest) | **[Reassign →]** (target picker, **defaults to the suggested rider**) · **[Ignore]** (dismiss for this plan) |
| **Overloaded rider** | Finish ETA / stop count vs threshold + a lighter rider nearby | **[Rebalance →]** (move N stops to the suggested lighter rider) · **[Ignore]** |
| **Unassigned shipment** | The shipment + nearest eligible rider | **[Assign →]** · **[Leave]** |

Reassign/Rebalance can act per-shipment or per-pincode-group; ops confirms; the plan **recomputes** and the flag clears. **Ignore** records the dismissal so it doesn't re-nag for that plan/wave.

## Flow
**Auto-plan (Phase 1) → Review flags + suggestions → Reassign / Rebalance / Ignore → Approve & Dispatch (locks) → Rider executes locked route → actual mileage auto-recorded.**

## Tickets (bottom-up)

### Backend
- **T1 · Suggestion targets** — extend the day-plan: per overlap/overload, compute a **recommended target rider** (nearest and/or lightest). Reuses the routing matrix; adds `suggested_target_employee_id` to each flag. *(Per-rider stop counts already shipped in Phase 1.)*
- **T2 · Reassign endpoint** — `POST /api/v1/routes/reassign` `{shipment_ids[], to_employee_id}`, manager-gated: updates `employee_id`, writes an `assignment` `OrderEvent`, **syncs to PIA** via `_sync_shipment_to_pops` (the consolidated `update_order_fields` path), records who/when. *(Builds on the existing change-rider logic.)*
- **T3 · Ignore flag** — persist a dismissal so an overlap/overload doesn't re-flag for that date+wave (small `IgnoredFlag` or a field on the RoutePlan).
- **T4 · RoutePlan model** — per rider per date+wave: planned stop order (snapshot), `status` (draft/dispatched), `locked_at`, `dispatched_by`. `makemigrations`.
- **T5 · Dispatch endpoint** — `POST /api/v1/routes/dispatch` `{date, wave}`: snapshots + **locks** the plan; exposes the locked route to riders.
- **T6 · Rider reads locked route** — a rider's session reads the **dispatched/locked order** (instead of live re-optimizing) when a dispatched plan exists; keep the debounced live ETAs *within* that locked order.
- **T7 · Post-dispatch new order** (decision 5) — inbound order for an already-dispatched rider: **delivery → flag to reassign** to another rider; **pickup → append** to the dispatched rider's route.

### Frontend
- **T8 · Day-view actions** — turn the Phase 1 overlap suggestions + overload badges into **[Reassign] / [Rebalance] / [Ignore]** controls; reassign opens a **target picker defaulting to the suggested rider**; ignore dismisses the flag.
- **T9 · Approve & Dispatch** — header control with confirm; shows locked state per wave.
- **T10 · Rider app** — read + render the **locked dispatched route** + ETAs; reflect the "dispatched" state.
- **T11 · Wiring** — endpoints in `config/api.ts`, `ApiClient` methods, hooks, shared types.

## Definition of done
- Given an overlap, **when** ops clicks **Reassign** and accepts the suggested rider (or picks another), **then** the shipment moves rider, **syncs to PIA**, and the plan recomputes with the overlap cleared.
- Given a flag ops disagrees with, **Ignore** dismisses it and it doesn't re-nag for that plan/wave.
- Given a reviewed plan, **Approve & Dispatch** locks it and the affected riders' apps show the **locked ordered route + ETAs**.
- Post-dispatch: a new **delivery** for a dispatched rider is flagged to reassign; a new **pickup** is appended to their route.

## Open sub-tasks / risks
- **POPS reassign-sync reliability** — reassign rides the consolidated `update_order_fields` path; the ~33% "empty response" false-negative was just fixed. **Monitor `sync_status` success rate post-deploy** to confirm it climbs.
- **External / POPS riders** — no `RiderAccount` → **default mileage** (decision: keep default + document; extending vehicle control to them is its own future feature). Reassigning *to* an external rider works for assignment; their mileage uses the default.
- **Lock + waves** — lock per wave; a later wave can be planned/dispatched independently.
- **Re-route quota** — a reassign triggers a re-optimize for affected riders; keep it manual/debounced (protects the ORS quota).

## Out of scope (still)
Auto-assignment, zone grouping, batch multi-driver solving, OR-Tools — unchanged from the PRD's non-goals.
