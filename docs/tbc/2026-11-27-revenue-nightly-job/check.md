# CHECK - Nightly revenue job

## Commands

```
npx tsc --noEmit → clean (exit 0)
npx vitest run src/lib/coach/remote/revenue src/app/api/coach/remote/revenue-daily-cron src/app/api/coach/remote/deal-drivers src/app/api/coach/remote/agents src/components/remote-sales → passed (exit 0)
npm run db:verify → 0382 executes clean, rolled back (exit 0)
node scratchpad/probes/p0382.mjs → rolled back on production: close_date_near 7 valid, 61 and "abc" refused, deal_stage still valid; service insert ok; same day twice 23505; unknown reason 23514; rep reads own 1; rep insert 42501; other company reads 0; update ignored (exit 0)
npm run check → gates the commit
```

## Findings

No findings.
