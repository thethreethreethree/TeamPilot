# CHECK — truncation-class completion

## Verification run (A38 — canonical command + exit code)
Canonical command: `npm run check`.

## Findings
### F1 — three unbounded-`.select()` truncation instances (the class remainder)
file+line: `dashboard/route.ts` (agent sessions, unbounded) · `care/agent/analytics/route.ts` (`.limit(5000)`) · `list/route.ts` (badge + signal event reads, `.in("subject", subjects)` unbounded).
class: JS-side aggregation over a PostgREST-capped read → wrong derived count/rate/badge on high-growth data (the recorded `unbounded_select_silent_truncation_1000cap` class). These are the lower-severity remainder after the KPI HIGH instance (fixed in build xo).
severity: medium (dashboard: >1000 sessions) / medium (CARE analytics: >5000 window-conversations) / low (list-badge: bounded by the 300-session cap, only past heavy regeneration). Founder chose "fix them all".
sweep-command: this completes the sweep started in xo/xn — `grep -rnE "\.select\(" the three routes`; every unbounded aggregation now inside a `fetchAllPaged(...).range(...)` window. The KPI cron + trajectory + team-analytics + finance were already confirmed clean earlier in the session.

## Targeted tests
```
$ npx vitest run src/app/api/coach/sales-session/list src/app/api/care/agent/analytics src/app/api/coach/sales-session/dashboard
 Test Files  3 passed (3)
      Tests  9 passed (9)
```

## Full gate
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS, 0 tenant-pin risks)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs (2 match) · manifest (12) · artifacts · residual (3) · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2740 passed | 15 skipped (2755)
EXITCODE=0
```
