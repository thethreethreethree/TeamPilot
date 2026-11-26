# CHECK - Revenue Phase 4: win/loss, deal drivers, account activity

## Commands

```
npm run db:verify → 0375 ok (rolled back)
probe p0375.mjs (production, rolled back, counts only), fixture deal on a real two-way call, then won:
  rep: activity calls 1, closed_at set
  another plain member: activity calls 0, no signal row
npx vitest run src/lib/coach/remote src/components/remote-sales src/app/api/coach/remote → 168 files passed (exit 0)
npx vitest run src/lib/coach/remote/revenue/__tests__/accounts.test.ts → 3 passed (exit 0)
tsc clean · theme / rls / invariant / reachability / writer audits ✓
npm run check → gates the commit
```

## Findings

No findings.
