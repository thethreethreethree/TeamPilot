# CHECK - An audit check: service-role call reads must check hides

## Commands

```
scan → 22 service-role routes read calls without a hide helper; each read and listed with a reason (pitch-score and prospects/[pid] gate through the caller's client)
npm run invariant:audit → Violations: 0; with the helper renamed out of sales-session/list → Violations: 1 naming it; restored → 0
```

## Findings

### F1 - nothing stopped a new service-role route from naming hidden calls
class: an RLS rule the service role bypasses, guarded only by review.
sweep: Invariant 43 over every API route.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 963 passed | 1 skipped · Tests 6948 passed | 15 skipped
```
