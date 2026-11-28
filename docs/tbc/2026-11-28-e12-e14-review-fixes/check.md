# CHECK - E12–E14 review fixes

## Commands

```
npx tsc --noEmit -p . → exit 0
npx vitest run engage/, askCoach.test, revenue/ (incl. dealCalls.exclude), src/lib/api, market, on-demand-agents, prospects routes, DealAccountContacts.render → all passed after the playbook route test's mock gained .range
npm run check → gates the commit
```

## Findings

No findings left open beyond the residuals in closure.md. Fixed from the review: the run cut off without maxDuration, a throwing claim stopping later agents, hidden calls taking the newest places, battlecards reading only openings, truncation and URL length in recommended contacts, short API pages, the capped note history. Confirmed sound by the review: company pins in playbookReview, the moved route's checks, call_linked firing only after a successful link, the scores API's columns, battlecard access.
