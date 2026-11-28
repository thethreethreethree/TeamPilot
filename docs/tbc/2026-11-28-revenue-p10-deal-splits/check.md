# CHECK - deal splits

## Commands

```
npm run db:verify → 0394 executes clean, rolled back (exit 0)
node scratchpad/probes/p0394.mjs → rolled back on production: 60/40 ok; the rep alone at 100 ok; sum 90, rep missing, a person twice, another company's person, a 0% share each refused 23514; the rep setting their own ok; another rep refused 42501; the latest split current (90/10); delete 0 rows
npx vitest run dealSplits.test, DealSplit.render, ForecastBoard.render, prospects routes (split action, splitFailed), RemotePipeline*, revenue/ → passed
npm run check → gates the commit
```

## Findings

No findings beyond three caught while building: the noFailedReadAsEmpty guard refused the editor treating a failed team read as an empty team (now said, and no owner can be added); the probe's own cleanup masked RLS's 42501 as 25P02 (fixed in the probe); a failed split read would have reached the panel as "no split" (JSON drops undefined) — the route says splitFailed.
