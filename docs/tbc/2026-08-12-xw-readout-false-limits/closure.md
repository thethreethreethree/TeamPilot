# CLOSURE — readout false-limits

## What shipped
`admin/coach-readout` (stepEvents / gradeEvents / analyzeEvents) and `brain/learning-summary` (coachEvents) now
page their windowed-event aggregations via `fetchAllPaged`, so the readout counts are correct past 1000 events in
the window. Both routes' §3.4 error combines are preserved by adapting fetchAllPaged's throw back to a
`{data,error}` shape. Both files' now-stale FALSE_LIMIT_ALLOWLIST entries were removed (the xu self-cleaning check
required it). This empties the founder's "fix the false limits" item down to the two genuinely-open sites: the
finance register (a DISPLAY truncation needing a load-older UI) and care.ts (the c5fbd454 KEEP/REVERT decision).

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0 (FALSE_LIMIT self-cleaning check + self-tests pass)
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2744 passed | 15 skipped (2759)
EXITCODE=0
```

The >1000-row paging boundary is covered by paginate.test.ts; neither route has its own unit test (stated in
check.md — no test claimed that was not written).

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "brain/learning-summary's decisionEvents (.limit 1000) + topicRows (.limit 500) are windowed aggregations that can still truncate a very busy 28-day window.", "why_skipped": "They are ≤ PostgREST max_rows — the honest single-page max, NOT 'false limits' (the invariant flags only >1000). Paging them too is a correctness nicety beyond the queued 'fix the false limits' scope, and far less likely to bite (decisions/topics accrue much slower than coach events).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T14:10:00Z", "outcome": "Opened + assessed: left as a noted lower-severity residual to keep this build scoped to the false-bound (>1000) item. A follow-up could page them for full correctness if a team's 28-day decision/topic volume ever approaches 1000." },
  { "id": "R2", "item": "Neither route has a unit test, so the paged read shape + error combine are guarded only by typecheck + the shared paginate.test.ts, not a route-level test.", "why_skipped": "These are large multi-read route handlers with no existing test harness; the change is a mechanical read-shape swap preserving the error combine, and the mechanism is tested. Building a route test harness for two untested analytics routes is out of scope for a false-limit fix.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T14:11:00Z", "outcome": "Opened + assessed: accepted for a mechanical swap; a route test for these readouts is a reasonable separate hardening (they had zero coverage before this too)." }
]
```

## Un-named reliance
- Relies on every consumer of these reads being order-independent (window-filter + count) so paging by `id` (not
  the old occurred_at/created_at order) changes nothing — confirmed by reading each aggregation, not a live run.

## Status
Complete; full gate exit 0 (pasted above). Commit with the TBC-Build trailer + explicit paths, then push.
