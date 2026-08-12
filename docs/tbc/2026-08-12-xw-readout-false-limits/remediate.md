# REMEDIATE — F1 readout false-limits

## F1 — windowed-event aggregations capped at 1000 rows → wrong readout numbers
Root cause: four windowed `events` reads used a fixed 2000-row cap; PostgREST returns ≤1000, so the in-memory
counts (step velocity, grade mix, principle aggregation, coach-pattern stats) undercount past 1000 events in the
window.

Remediation (mirror the established pattern; preserve each route's error handling):
1. Wrap each read in `fetchAllPaged(...).order("id").range(...)` — order-independent (every consumer only
   window-filters + counts).
2. Adapt fetchAllPaged's throw-on-error back to `{ data, error }`: brain via an inline `.then/.catch` inside its
   Promise.all; admin via a `pagedEventCount` helper. Both keep the existing §3.4 combine (chainReadError /
   secondaryReadError) byte-identical.
3. Remove both now-stale FALSE_LIMIT_ALLOWLIST entries (the xu self-cleaning check flags them once the `.limit` is
   gone). The allowlist now holds only finance (display truncation → needs a load-older UI) and care.ts (founder
   c5fbd454 KEEP/REVERT) — both genuinely still-open, with the reason annotated.

Boundary (A26): brain's decisionEvents (`.limit(1000)`) + topicRows (`.limit(500)`) are ≤ max_rows — the honest
single-page max, NOT false bounds. They can still truncate a very busy 28-day window; noted as residual, not
fixed here (that would exceed the "false limits" scope).

Outcome: fixed. class: false-limit truncation of a JS aggregation. severity: medium (brain) / low-medium (admin).
This empties the "fix the false limits" queue item down to the two founder-gated / UI-needing sites.
