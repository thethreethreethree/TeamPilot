# CHECK - Shared saved searches (company streams)

## Commands

```
npm run db:verify → 0362 ok; npm run db:apply → verify:live passed
npx vitest run saved-searches savedSearchFollow search page → passed (18 + 9)
noFailedReadAsEmpty, americanSpelling → 7 passed; invariant-audit 0 (events route allowlisted with why); rls-audit passed; theme clean; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - no company streams
class: missing sharing (F12.7).
sweep: saved searches.
severity: low
