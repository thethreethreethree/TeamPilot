# CHECK — Team practice rollup + review fixes

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (12) + artifacts + residual + freshness all ✓
  Test Files  581 passed | 1 skipped (582)
       Tests  3812 passed | 15 skipped (3827)
GATE_EXIT=0
```
(+4 practiceAnalytics tests: Finding-1 null + team rollup.)

## What the tests prove
- Finding-1: per-focus `latest`/`first` is NULL (not a fabricated 0) for a skill drilled but never applied — renders
  "not applied yet" (§3.4).
- Team rollup: honest zeros when nobody practiced; correct aggregate (active reps, total, avg latest, improving/slipping
  counts); avgLatest null when active reps have no applied score (no fabricated average).
- §A18: the team rollup is a pure aggregate; the manager per-rep summary still exposes only {attempts, latest, trend}
  (existing test) — no individual score list reaches the leader view.

## Not unit-tested (bounded honestly)
The route wiring (teamPractice assembly, company_id-pinned read) and the stat-card render are presentation over the
tested aggregate; the aggregation itself is fully unit-tested.

## Findings
No findings — the rollup reuses already-computed per-rep summaries (no new query), the honesty fix is checked against
the review and test-locked, the tenant filter is defense-in-depth, and the §A18 aggregate names no individual.
