# CHECK - E8

## Commands

```
npm run db:verify → 0389 executes clean, rolled back (exit 0)
node scratchpad/probes/p0389.mjs → rolled back on production: quiet trigger ok; with extra keys refused 23514; unknown kind refused; close_date_near still ok; on-demand agent ok; empty instruction and 81-char name refused 23514; edit refused P0001; retire ok; delete 0 rows
npx vitest run RemoteEngage.agents.render, engage/__tests__, daily.test → 42 passed
npm run check → gates the commit
```

## Findings

No findings beyond two fixed in the build: the route's schema wasn't shareable (moved to agentSchema.ts), and E7's panel test mock needed the usage URL (fixed in E7's commit).
