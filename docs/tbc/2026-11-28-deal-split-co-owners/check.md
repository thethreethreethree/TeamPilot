# CHECK - deal split co-owners

## Commands

```
npm run db:verify → 0395 executes clean, rolled back (exit 0)
node scratchpad/probes/p0395.mjs → rolled back on production: a signed-in user's split for another company refused 42501 before any read; a removed member refused 23514; rss_is_co_owner true while named, false after "back to one owner"; rss_co_owned_deals lists it; a signed-in user can't call it (42501)
npx vitest run prospects routes (incl. co-owner GET), forecast route (co-owned snapshot at share), ForecastBoard.render (footnote), DealSplit.render (read only, former teammate), RemotePipeline.coOwned.render → passed
npm run check → gates the commit
```

## Findings

No findings left open beyond the residuals in closure.md. Fixed from the review: the definer trigger answering about other companies, co-owners missing from their own board and skewing team rows, the missing-table check by message, removed members nameable, dead state. Confirmed sound by the review: the insert policy, the select policy, append-only, error mapping, the 150-id reads.
