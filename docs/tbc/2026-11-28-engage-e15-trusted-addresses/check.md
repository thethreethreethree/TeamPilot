# CHECK - E15

## Commands

```
npm run db:verify → 0393 executes clean, rolled back (exit 0)
node scratchpad/probes/p0393.mjs → rolled back on production: a v4+v6 list ok; null ok; "example.com" refused 22P02; 21 entries refused 23514; changing the list refused P0001 (the freeze guard)
npx vitest run ipAllow.test, publicApi.test, mcp.test, publicApiUpload.test, ApiKeysPanel.render → 44 passed
npm run check → gates the commit
```

## Findings

No findings.
