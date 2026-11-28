# CHECK - E13

## Commands

```
npx tsc --noEmit -p . → exit 0
npx vitest run src/lib/api/__tests__/publicApi.test.ts → 12 passed (incl. the scores resource: pinned, hidden left out, withheld columns never selected)
npm run check → gates the commit
```

## Findings

No findings beyond the one caught while building: the item read first used .limit(5000), a false bound; it is paged to the end.
