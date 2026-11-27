# CHECK - Upload a call by API

## Commands

```
npm run db:verify → 0387 executes clean, rolled back (exit 0)
node scratchpad/probes/p0387.mjs → rolled back on production: the scopes check is api_keys_scopes_check (replaced); ['read','upload'] accepted; ['write'] refused 23514; a call_needs_voice notice accepted; an agent_ran notice with deal_name still refused 23514 (exit 0)
npx vitest run src/app/api/coach/sales-session/[id]/upload-recording → 26 passed after the move (exit 0)
npx vitest run src/lib/api src/components/remote-sales src/components/sessions src/components/sales-coach src/app/api/coach/sales-session src/app/api/coach/remote/settings → 1,571 passed (exit 0)
npm run check → gates the commit
```

## Findings

No findings.
