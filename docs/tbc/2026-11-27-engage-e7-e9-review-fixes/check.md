# CHECK - E7–E9 review fixes

## Commands

```
npx tsc --noEmit -p . → exit 0
npx vitest run usage route, on-demand-agents route, RemoteEngage.agents.render, engage/__tests__ → 40 passed
npm run check → gates the commit
```

## Findings

No findings left open beyond the residuals in closure.md. Fixed from the independent review: usage double count (offset paging), "partial" at exactly the cap, gone-quiet wording for deals with no calls, the first-night note, a retire clearing a draft, and the run's rate-limit comment. Confirmed sound by the review: tenant pins on users/stats, hidden calls, the 0389 trigger match, template editor values, on_demand_agents RLS, runs by id through askCoach.
