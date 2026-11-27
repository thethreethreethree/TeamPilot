# CHECK - deal-flow review fixes

## Commands

```
npx tsc --noEmit -p . → exit 0
npx vitest run revenue/__tests__, NotificationBell.render, ForecastBoard.render, RemotePipeline.panelTabs.render, forecast route, prospects routes → 161 passed
npm run check → gates the commit
```

## Findings

No findings left open beyond the residuals in closure.md. Fixed from the review: account moves hidden, exact-day prep missing late bookings and missed nights, the bell link not switching the view on the same page, late-evening reminders, string-compared timestamps, a reminder failure skipping the company's warnings, a silent Monday default. Confirmed sound by the review: tenant pins, erased names, the 0391 guard (0226 and the schedule route unaffected), the claim order.
