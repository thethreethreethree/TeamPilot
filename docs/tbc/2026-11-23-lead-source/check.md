# CHECK - Lead source on prospects

## Commands

```
npx vitest run leadSource, askPipeline, prospects, macroMode tests and src/app/api/coach/remote/prospects → 42 passed, exit 0
npx tsc --noEmit -p . → exit 0
```

Full migration chain on PGlite (every file in order, then 0313 again):

```
migrations replayed; failures: 0 []
view: [{"name":"Acme","amount":"500","source":"Webinar"},{"name":"Beta","amount":null,"source":null}]
after source event: Referral
bad source refused: {"text":""} · {"text":5} · 61 characters
unknown kind refused
6-arg form gone: true
exit 0
```

Production:

```
npm run db:apply → applying 0313_prospect_lead_source.sql … ok · DB now at 0313 · ✅ ALL 32 invariants hold
```

## Findings

### F1 - the existing create-route test pinned the exact function arguments
class: a contract change (a new defaulted parameter) visible to an exact-match test.
sweep: `grep -rn "rss_create_prospect" src` → the create route and its test; the test now expects p_source and a new
case passes a source.
severity: low

### F2 - live app and new database between push and deploy
class: schema applied before the code that uses it is deployed.
sweep: `grep -n "p_session: body.sessionId" src/app/api/coach/remote/prospects/route.ts` → the live (old) code calls
with six named arguments; the new function's seventh is defaulted, and the view only appended a column.
severity: low
