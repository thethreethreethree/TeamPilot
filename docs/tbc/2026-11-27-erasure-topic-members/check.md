# CHECK - Erasure of topic-group members

## Commands

```
npm run db:verify → 0385 executes clean, rolled back (exit 0)
node scratchpad/probes/p0385.mjs → rolled back on production: plain update ignored; 2 groups changed; g1 keeps "probe pricing" and its name; g2 all erased → name "[erased]"; a completed request refused; another company refused (exit 0)
npx vitest run src/app/api/coach/remote/erasure src/lib/coach/remote/__tests__/marketErasure.test.ts → 34 passed (exit 0)
npm run check → gates the commit
```

## Findings

No findings.
