# CHECK — capture-cost dashboard

## Verification run (A38 — canonical command + exit code)
Canonical command: `npm run check`.

## Findings
No findings. New read-only diagnostic; both hypotheses (batching handles >1000; a failed count never reads as 0) were
confirmed by the code + the route test. Items checked with nothing to fix: manager gate (403 non-manager);
company scope (RLS + getCurrentCompanyId); honest-zero only when total===0; fail-loud (500) on a read error.

## Targeted tests
```
$ npx vitest run src/app/api/coach/sales-session/capture-health
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Full gate
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (12) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2740 passed | 15 skipped (2755)
CHECK_EXIT=0
```
