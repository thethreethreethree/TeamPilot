# Phase 1 — Build

## Built

| path | what it does | clause |
|------|--------------|--------|
| `supabase/migrations/0220_schedule_event.sql` | The append-only `schedule_event` log (company_id, type, actor_id, payload jsonb, occurred_at, monotonic `seq` identity). Append-only enforced FAIL-LOUD: a `BEFORE UPDATE/DELETE` trigger that RAISES + revoked UPDATE/DELETE grants. RLS `company_id = auth_company_id()`. `append_schedule_event()` security-invoker appender. | 3.1 (immutable events), 3.4 (fail-loud vs 0004's silent rule), A28 (mirrors 0004/company_id) |
| `src/lib/schedule/types.ts` | Event vocabulary + derived-state types (Shift/TimeOff/Availability/CoverageRequirement/ScheduleState). | 3.1 |
| `src/lib/schedule/deriveState.ts` | The pure, deterministic projector `deriveState(events) → ScheduleState`. No clock, no random, no IO. Folds events by `seq`. | 3.1, 2.2 (single source of derived state) |
| `src/lib/schedule/eventSchema.ts` | `validateScheduleEvent(type, payload)` — per-type Zod validation at the append boundary. | plan §5 (validate before append) |
| `src/app/api/schedule/events/route.ts` | POST validates + appends one event (never mutates); GET pages the full log (fetchAllPaged — no 1000-row truncation) and returns `{events, state}`. | 3.1, 3.4 (honest errors), the 1000-cap class |
| `src/lib/schedule/__tests__/deriveState.test.ts` | 9 tests: full replay, determinism, order-independence, correction-is-a-new-event, redefine-preserves, swap, availability/coverage, robustness, purity. | A30 (gate the lesson) |
| `src/lib/schedule/__tests__/eventSchema.test.ts` | 8 tests: valid/invalid per type, unknown type, uuid + time-format + vocabulary rejection. | A30 |

## Decisions taken (flagged in think.md Step 4, grounded — override welcome)

- **D-tenancy (Q4):** `company_id`, by A28 precedent (166 migrations vs 0 for `org_id`). The plan's `org_id` maps to it. Sub-org/location: no precedent → future non-breaking addition, not Phase 1.
- **D1 (Q3):** `schedule_event` is a NEW table (spec-as-written), not the generic `events`.
- **D2:** Phase 1 does NOT persist materialized derived-state tables — A31 forbids schema with no read-consumer (Phase 5/6 are the readers); the pure projector is the source and fully meets Phase 1 acceptance. Materialized projections + their refresh model come when a consumer needs them.
- **Append-only style:** raise-trigger (fail-loud) over 0004's silent `do instead nothing` — the plan's explicit choice, and the honesty-aligned one (3.4).

## Features (inventory for the reachability assertions)

### append a schedule event
POST `/api/schedule/events` validates a `(type, payload)` against its schema, then appends ONE immutable
event via `append_schedule_event`. Files: `route.ts`, `0220_schedule_event.sql`, `eventSchema.ts`.
- write-path: EXISTS — `route.ts` POST → `sb.rpc('append_schedule_event')` (a manager/employee, or the
  Phase-4 AI on their behalf, POSTs `{type,payload}`; validated then written). human_can_set: true.
- read-path: EXISTS — the appended event is returned by the GET below and replayed into state;
  human_can_see: true.

### derive schedule state from the log
GET `/api/schedule/events` pages the full log (fetchAllPaged) and returns `{events, state}` where `state`
is `deriveState(events)`. Files: `route.ts`, `deriveState.ts`, `types.ts`.
- write-path: EXISTS — state is derived from events written by the append path above; human_can_set: true
  (a human's appended events change the derived state).
- read-path: EXISTS — `route.ts` GET returns `state`; correctness proven by `deriveState.test.ts` replay;
  human_can_see: true.

## Step 7 — Reachability (A31), both directions of the seam

```json
[
  {
    "feature": "append a schedule event",
    "files": ["src/app/api/schedule/events/route.ts", "supabase/migrations/0220_schedule_event.sql"],
    "write_path": { "exists": true, "where": "route.ts POST → sb.rpc('append_schedule_event')", "human_can_set": true, "note": "an authenticated manager/employee (or the Phase-4 AI on their behalf) POSTs {type,payload}; validated then written" },
    "read_path":  { "exists": true, "where": "route.ts GET → fetchAllPaged(schedule_event) → deriveState → {events,state}", "human_can_see": true }
  },
  {
    "feature": "derive schedule state from the log",
    "files": ["src/lib/schedule/deriveState.ts"],
    "write_path": { "exists": true, "where": "events written by the append path above", "human_can_set": true },
    "read_path":  { "exists": true, "where": "GET returns state; unit-proven by deriveState.test.ts replay", "human_can_see": true }
  }
]
```

Note on altitude: Phase 1 has **no end-user UI** (surface is Phase 5–6, explicitly). The "human" at the seam in Phase 1 is the API caller (the schedule builder / employee client that Phases 5–6 add). The write and read paths both EXIST and are exercised (append RPC + paged GET + replay tests); the human-facing *surface* over them is the next phases' scope, not a dead seam. This is a phased foundation, not the A31 "schema-complete but unreachable" anti-pattern — the seam is wired and tested end to end at the API altitude.
