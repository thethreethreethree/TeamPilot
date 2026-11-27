# CHECK - E7

## Commands

```
npx tsc --noEmit -p . → exit 0
npx vitest run src/lib/api/__tests__/publicApi.test.ts src/lib/api/__tests__/usageReport.test.ts → 13 passed
npx vitest run src/app/api/coach/remote/settings/api-keys/usage → 3 passed
npm run check → gates the commit
```

## Findings

No findings beyond the one fixed during the build: a refusal past the daily limit isn't recorded in api_usage, so the column counts only per-second refusals and is named "Too fast".
