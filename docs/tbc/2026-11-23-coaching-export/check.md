# CHECK - Coaching export

## Commands

```
npx vitest run src/app/api/coach/remote/coaching-metrics → 4 passed (export.test.ts: CSV shape, "=" name neutralized, audit row)
npm run check → exit 0 · Test Files 878 passed | 1 skipped · Tests 6556 passed | 15 skipped
```

## Findings

### F1 - req.nextUrl in a route whose tests pass a plain Request
class: reading Next-only request fields in a handler others call with a standard Request.
sweep: `grep -n "new URL(req.url)" src/app/api/coach/remote/coaching-metrics/route.ts` → the export switch reads the
standard URL (fixed before commit).
severity: low

### F2 - no monthly coaching email
class: the second half of F16.11 (a subscribed report).
sweep: `grep -rln "weeklyDigest" src/lib` → the weekly digest exists; no monthly coaching report.
severity: low
