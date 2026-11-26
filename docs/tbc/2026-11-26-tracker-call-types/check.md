# CHECK - Tracker call types, and adoption that counts only what a tracker hears

## Commands

```
npm run db:verify → 0361 ok; npm run db:apply → verify:live passed
npx vitest run trackers adoption trackers routes KeywordTrackers → 49 + 1 passed
noFailedReadAsEmpty, americanSpelling → 7 passed; invariant-audit 0; rls-audit passed; theme clean; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - no call-type scope
class: missing filter (F11.3).
sweep: every place a tracker's scope applies (two scans, backfill, preview, adoption).
severity: low

### F2 - adoption ignored a tracker's dates
class: a re-derived verdict that dropped a term (§2.2).
sweep: computeAdoption, its two callers and the by-team breakdown.
severity: medium (0 trackers in production)
