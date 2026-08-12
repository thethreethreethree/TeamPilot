# BUILD — KPI compute-cron agent-enumeration truncation

## Feature inventory
### The cron now enumerates EVERY distinct agent (not the first 1000 session-rows' worth)
- write-path: unchanged (kpi_snapshot idempotent replace per agent/metric/period).
- read-path: the agent-enumeration read is now `fetchAllPaged(coaching_sessions.select("company_id, agent_id")
  .order("id").range(...))` — every distinct (company_id, agent_id) is seen, then `[...keys()].sort().slice(0,
  BATCH_AGENTS)` takes the first BATCH_AGENTS deterministically. Previously a fixed 5000-row cap → PostgREST
  returned ≤1000, so agents whose sessions sort late (or when per-agent counts pushed the batch past 1000 rows)
  were dropped from the run entirely. On a read error, fetchAllPaged throws → caught → existing `{ computed: 0 }`
  shape. Proven by the route test (enumerate → load → 12 inserts for the agent) + paginate.test.ts (>1000 boundary).

## Files changed
- src/app/api/coach/kpi/compute-cron/route.ts — page the agent enumeration (drop the 5000 cap); deterministic
  sort+slice for the batch.
- scripts/invariant-audit.mjs — remove the now-stale compute-cron FALSE_LIMIT_ALLOWLIST entry (the xu
  self-cleaning check flagged it once the .limit was gone).
- src/app/api/coach/kpi/compute-cron/__tests__/route.test.ts — re-key the mock's read discrimination from `.limit`
  (gone) to the enumeration read's `company_id` select column; 7/7 pass.

## Holistic (§1.5.1)
Same batch semantics (first BATCH_AGENTS by agent_id), minus the truncation. The separate no-rotation gap (agents
past the first 100 never processed) is a design decision left founder-gated. Dormant cron → zero live-user risk.
