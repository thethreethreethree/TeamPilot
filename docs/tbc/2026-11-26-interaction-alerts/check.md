# CHECK - Interaction alerts on calls not yet coached

## Commands

```
npx vitest run interactionAlerts coaching-metrics CoachingInbox.metrics.render → 3 + 12 + 14 passed
node scripts/invariant-audit.mjs → Violations: 0
npx tsc --noEmit → clean; eslint on the changed files → clean
npm run check → gates the commit (&&)
```

## Findings

### F1 - no way to tell which uncoached call is unusual
class: a list with no triage signal.
sweep: the by-rep uncoached list (the only list of uncoached calls).
severity: medium
