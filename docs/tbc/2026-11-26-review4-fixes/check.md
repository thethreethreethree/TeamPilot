# CHECK - Acting on the fourth review

## Commands

```
npx vitest run CoachingInbox coaching-metrics dashboard/sales-coach/kpi → 23 passed (90-day window sees a 300-day-old call; failed period keeps buttons; unit; refused team)
npx vitest run kpi/me → passed (team narrowing unchanged)
npx tsc --noEmit → clean
```

## Findings

### F1 - the period before saw younger calls than this period
class: a comment claiming what the code didn't do.
sweep: the other windows in the route (prevSince, requestsSince) checked by the reviewer and sound.
severity: medium

### F2 - a failed period took its buttons with it
class: a control inside the state it controls.
sweep: the inbox list has its own failed state already.
severity: medium

### F3 - a refused team left the company's cards
class: stale data kept on error.
sweep: both failure paths in loadMe.
severity: low

### F4 - team quota against the company target
class: a verdict used outside its scope.
sweep: the per-rep table's quota is per rep against the same company target — a pre-existing choice, recorded.
severity: low
