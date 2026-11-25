# CHECK - Fixes from the second 26 Nov review

## Commands

```
npx vitest run kpi page + kpi routes + coaching-metrics + library routes + library page + RemoteCallPanel → first 6 failed (library mocks had no paging for the events read) → mocks page → 56 passed
npx tsc --noEmit → clean
```

## Findings

### F1 - the KPI team table reset or showed stale rows
class: stale state across a changed query.
sweep: pick kept on refresh; sequence guard; failure clears rows.
severity: medium

### F2 - the coaching trend compared different call ages
class: a comparison window with a shorter base.
sweep: 210-day lookback.
severity: low

### F3 - archive state from a capped read
class: capped read.
sweep: paged.
severity: low

## Final

```
npm run check → exit 0 · Test Files 963 passed | 1 skipped · Tests 6946 passed | 15 skipped
```
