# CHECK - E14

## Commands

```
npx tsc --noEmit -p . → exit 0
npx vitest run MarketView.*, market battlecard route, market.test → 32 passed
npm run check → gates the commit
```

## Findings

No findings beyond one caught while building: the instruction was first exported from the route file (Next.js allows only handlers there); it lives in battlecard.ts.
