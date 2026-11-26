# CHECK - The library reads every item

## Commands

```
npx vitest run remote/library remote-sales/library → 18 + 2 new passed (302 items with 2 removed → 300 shown, not truncated; 305 with 1 removed → 300, truncated)
npx tsc --noEmit → clean
```

## Findings

### F1 - a cap applied before removals
class: limit before filter.
sweep: this route's other reads (sessions, snippets, profiles) are by the ≤300 shown ids.
severity: medium

### F2 - removals read error ignored
class: error-as-no-data.
sweep: the same read only.
severity: medium
