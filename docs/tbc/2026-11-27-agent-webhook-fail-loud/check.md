# CHECK - Agent webhook fail loud

## Commands

```
curl https://elostate.com/api/health → capabilities.webhooks false; build d4dc9ec (exit 0)
npx vitest run src/lib/coach/remote/engage → 21 passed (exit 0)
npm run check → gates the commit
```

## Findings

No findings.
