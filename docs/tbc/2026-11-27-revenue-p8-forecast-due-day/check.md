# CHECK - forecast due day

## Commands

```
npm run db:verify → 0391 executes clean, rolled back (exit 0)
node scratchpad/probes/p0391.mjs → rolled back on production: all companies default Monday; weekday 7 refused 23514; service role ok; a signed-in non-admin refused P0001; an admin ok; 'forecast_due' accepted; a second claim refused 23505; delete 0 rows; claims invisible to users
npx vitest run forecast route, ForecastBoard.render, revenue/__tests__, sales-coach, enumConstraintSync, RemotePipeline* → 687 passed; NotificationBell.render → 36 passed
npm run check → gates the commit
```

## Findings

No findings beyond the one the invariant audit caught (the admin roles written by hand; now admin_roles()).
