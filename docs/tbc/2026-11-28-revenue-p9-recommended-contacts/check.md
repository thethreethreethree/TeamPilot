# CHECK - recommended contacts

## Commands

```
npx tsc --noEmit -p . → exit 0
npx vitest run recommendedContacts.test, DealAccountContacts.render, prospects routes, RemotePipeline* → 64 passed
npm run check → gates the commit
```

## Findings

No findings beyond a test helper typed rank as string (typecheck caught it; now Rank).
