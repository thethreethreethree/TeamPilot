# CHECK - The team picker says when it couldn't check

## Commands

```
npx vitest run kpi coaching-metrics usage coaching-inbox team-stats coverage teamScope → 70 passed (503 when the tree can't be asked; nothing read)
npx tsc --noEmit → clean; eslint → clean
```

## Findings

### F1 - "Team not found" for a failed tree check
class: an unknown folded into "no".
sweep: teamFromRequest and its seven callers; 13 direct callers recorded.
severity: low
