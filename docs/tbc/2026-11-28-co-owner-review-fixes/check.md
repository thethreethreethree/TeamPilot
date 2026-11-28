# CHECK - co-owner review fixes

## Commands

```
npm run db:verify → 0396 clean, rolled back
node scratchpad/probes/p0396.mjs → same answers as 0395 (company first, removed refused, co-owner true then false, not callable signed-in)
npx vitest run prospects routes (coOwned without signals), RemotePipeline.coOwned.render (no AI tabs, controls :disabled), RemotePipeline* → passed
npm run check → gates the commit
```

## Findings

No findings left open. Fixed from the review: signals past a hide on co-owned rows, edit controls refusing in the read-only view, the all-companies scan, the unpinned calls read. Confirmed sound: no escalation (only the rep or their manager writes splits), the GET's pins and hide filter, POST refusing co-owners first, the snapshot's pin and rounding.
