# CHECK - E12

## Commands

```
npm run db:verify → 0392 executes clean, rolled back (exit 0)
node scratchpad/probes/p0392.mjs → rolled back on production: call_linked ok; with extra keys refused 23514; next_call_tomorrow still ok; playbook action ok; unknown action refused 23514
npx vitest run engage/__tests__ (incl. agents.callLinked), prospects routes, RemoteEngage.agents.render → 74 passed
node scripts/invariant-audit.mjs → 0 violations (the playbook route's stale write exception removed)
npm run check → gates the commit
```

## Findings

No findings beyond the stale invariant exception the move left behind (removed).
