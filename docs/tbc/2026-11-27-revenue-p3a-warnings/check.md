# CHECK - Revenue Phase 3a: Gong's deal warnings in dealRisk

## Commands

```
npm run db:verify → 0372 ok (rolled back)
probe p0372.mjs (production, rolled back, booleans only), fixture deal on a real call:
  as the rep: two_way true, pricing_mentioned false (ground truth: 0 pricing lines), staged true, 1 contact, contact on the call true
  as another plain member: no row (the deal isn't visible)
  stall_days: 14 accepted, 0 refused, 1.5 refused
npx vitest run src/lib/coach/remote/__tests__/dealRisk.test.ts → 21 passed (exit 0)
npx vitest run src/lib/coach/remote/__tests__/prospects.test.ts → 5 passed (exit 0)
tsc clean
npm run check → gates the commit
```

## Findings

No findings. Each reason fires on its fact and stays silent when the fact was not read.
