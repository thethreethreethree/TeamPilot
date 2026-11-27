# CHECK - Saved views without search text

## Commands

```
npm run db:verify → 0388 executes clean, rolled back (exit 0)
node scratchpad/probes/p0388.mjs → rolled back on production: a view with q refused 23514; without q ok (exit 0)
npx vitest run src/app/api/coach/remote/deal-views src/components/remote-sales/__tests__/DealBoard.render.test.tsx → 7 passed (exit 0)
npm run check → gates the commit
```

## Findings

No findings beyond the one fixed.
