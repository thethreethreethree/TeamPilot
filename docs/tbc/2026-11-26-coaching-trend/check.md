# CHECK - Coaching metrics against the 30 days before

## Commands

```
npx vitest run feedback lib + coaching-metrics + CoachingInbox → first ✗ my render test (two cells legitimately titled the same) → assert by row → 32 passed / 6 passed
npx tsc --noEmit → clean · eslint (route) → clean
```

## Findings

### F1 - a manager who stopped coaching would disappear
class: rows keyed only on the current period.
sweep: the earlier window's managers are included (tested).
severity: medium

### F2 - two counting copies for two windows
class: duplicated rule.
sweep: one feedbackTotals for both; the route's old inline loop removed.
severity: low

## Final

```
npm run check → exit 0 · Test Files 962 passed | 1 skipped · Tests 6938 passed | 15 skipped
```
