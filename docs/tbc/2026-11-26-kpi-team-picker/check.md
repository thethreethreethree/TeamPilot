# CHECK - KPI team table: pick one manager's team

## Commands

```
npx vitest run kpi/team → 12 passed (authz + the new team tests)
npx vitest run kpi + KPI page → 33 passed · npx tsc --noEmit → clean · eslint → clean
```

## Findings

### F1 - an empty team would leave the previous rows
class: stale state on an empty response.
sweep: a chosen team always replaces the rows.
severity: low

## Final

```
npm run check → exit 0 · Test Files 963 passed | 1 skipped · Tests 6946 passed | 15 skipped
```
