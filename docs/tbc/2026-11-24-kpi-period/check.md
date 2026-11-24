# CHECK - KPI period: 30 / 90 days / all time for the outcome numbers

## Commands

```
npx vitest run src/app/api/coach/kpi src/lib/coach/kpi → 112 passed (new: period helper; 30-day vs all-time revenue; unknown period = all time)
```

## Findings

### F1 - a card would pair a period number with an all-time trend
class: two numbers on one card computed over different windows.
sweep: the deltas computed for the five outcome cards; switched to the period rows.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 932 passed | 1 skipped · Tests 6800 passed | 15 skipped
```
