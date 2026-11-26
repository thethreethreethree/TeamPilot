# CHECK - Review fixes; pinned reader

## Commands

```
npx tsc --noEmit → clean (exit 0)
npx vitest run src/lib/api src/lib/coach/remote src/app/api → 2,495 passed (exit 0)
node scratchpad/probes/cols.mjs → all nine tables and views have company_id (exit 0)
npm run check → gates the commit
```

## Findings

No findings beyond the three review findings fixed here.
