# CHECK - Time on calls per person

## Commands

```
node durations.mjs (production, counts only) → last 30 days: 0 sessions · all time: total 376, audio 92, wall-clock 64, unknown 220
npx vitest run usage.test.ts + TeamUsage.time.render + usage route → 12 passed
```

## Findings

### F1 - most stored calls have no known length
class: an average over data with silent gaps.
sweep: the only other per-person duration average (KPI avg session duration) already uses known-duration only.
severity: medium (would understate time on calls)

## Final

```
npm run check → exit 0 · Test Files 917 passed | 1 skipped · Tests 6733 passed | 15 skipped
```
