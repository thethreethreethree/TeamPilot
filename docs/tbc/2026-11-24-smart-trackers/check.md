# CHECK - Smart trackers: the same idea in any words

## Commands

```
node replay0329.mjs (PGlite) → smart tracker with 11 examples refused · kind change refused (earlier this session, 2026-11-23)
npm run db:apply → 0329 ok (2026-11-23)
npx vitest run trackers route + smartTrackerScan + smartTrackers + trackerScan → 34 passed
npx vitest run KeywordTrackers.smart.render → 1 passed
```

## Findings

### F1 - smart hits had no time, so their chips couldn't jump to the moment
class: a second writer of a shared table not mirroring the first writer's fields.
sweep: compared every tracker_hits column between trackerScan and smartTrackerScan; at_ms was the only one missing.
severity: medium

### F2 - a backfill would re-read every smart tracker on each call
class: background AI work wider than the action that started it.
sweep: the only other AI backfill path is none; the keyword "scan" uses no AI.
severity: medium (cost)

### F3 - a smart chip would quote the example as if the customer said it
class: a stored value read as something it isn't.
sweep: tracker_hits.matched is read by the chips, the adoption views and search; adoption counts hits, search matches on tracker names — only the chip quotes it.
severity: low

## Final

```
npm run check → first: ✗ tbc:manifest (16 reads predated the record's start — re-read at 2026-11-24T01:13:07Z) → exit 0 · Test Files 913 passed | 1 skipped · Tests 6713 passed | 15 skipped
```
