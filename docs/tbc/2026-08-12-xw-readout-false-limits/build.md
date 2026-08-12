# BUILD — readout false-limits (admin/coach-readout + brain/learning-summary)

## Feature inventory
### Two analytics readouts now aggregate over the FULL windowed set, not the first 1000 rows
- write-path: none (read-only analytics). N/A.
- read-path: each windowed `events` read that fed an in-memory count is now paged via `fetchAllPaged(...).
  order("id").range(...)`, adapted back to `{data,error}` so each route's existing §3.4 error combine is
  unchanged:
  - `admin/coach-readout` — stepEvents (task step velocity), gradeEvents (grade mix), analyzeEvents (principle
    aggregation): each was `.limit(2000)`; a busy 30-day window past 1000 events undercounted. A `pagedEventCount`
    helper wraps the three; their errors still flow into `secondaryReadError` → 500.
  - `brain/learning-summary` — coachEvents (the section-3.6 pattern/suggestion aggregation the user sees): was
    `.limit(2000)`; now paged inside the Promise.all, error → `eCoach` → the existing chainReadError "unavailable".
  Behaviour proven by typecheck + the invariant audit (self-cleaning check + self-tests) at 0 violations; the
  >1000 paging boundary is covered by paginate.test.ts.

## Files changed
- src/app/api/brain/learning-summary/route.ts — page coachEvents (drop the 2000 cap), {data,error} adapter.
- src/app/api/admin/coach-readout/route.ts — `pagedEventCount` helper + page stepEvents/gradeEvents/analyzeEvents.
- scripts/invariant-audit.mjs — remove both now-stale FALSE_LIMIT_ALLOWLIST entries (the xu self-cleaning check
  requires it); leave finance (display, needs UI) + care.ts (founder KEEP/REVERT) with an explanatory note.

## Holistic (§1.5.1)
Same numbers, minus the truncation. brain's decisionEvents (.limit 1000) + topicRows (.limit 500) are ≤ max_rows
(honest single-page max, not false bounds) — noted as residual, not this scope. No write/schema change.
