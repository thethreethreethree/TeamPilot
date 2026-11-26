# CHECK - A failed tree check says so

## Commands

```
npx vitest run recordings rep-activity skills elo team → 39 + 1 passed (503 on an unanswerable tree check, nothing read)
node scripts/invariant-audit.mjs → Violations: 0
npx tsc --noEmit → clean
```

## Findings

### F1 - "not in your team" for a failed check
class: an unknown folded into "no".
sweep: the five single-rep / role routes.
severity: low
