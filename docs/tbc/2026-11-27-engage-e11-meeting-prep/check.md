# CHECK - E11

## Commands

```
npm run db:verify → 0390 executes clean, rolled back (exit 0)
node scratchpad/probes/p0390.mjs → rolled back on production: next_call_tomorrow ok; with extra keys refused 23514; deal_gone_quiet and deal_stage still ok; unknown refused 23514
npx vitest run engage/__tests__, daily.test, RemoteEngage.agents.render → 48 passed
npm run check → gates the commit
```

## Findings

No findings.
