# CHECK - Send a call to the company's CRM

## Commands

```
npx vitest run send-to-crm crmExport webhooks → 12 passed
npx vitest run send-cron → 4 passed (new: "a call.to_crm delivery is filled in at send time from the call's id (0330)")
node replay0330.mjs (PGlite, 0001–0330) → endpoint with call.to_crm: ok · enqueued (ids only): 1 · content in queue refused · unknown event refused (known local failures 0315/0327 only: no authenticator role / auth.sessions)
npm run db:apply → applying 0330_webhook_call_to_crm.sql … ok · DB now at 0330
npx vitest run MacroCallView.render → 12 passed (new: sends once and disables; 409 shows the server's reason and re-enables)
```

## Findings

### F1 - a queued CRM delivery could hold a second copy of a customer's words
class: content copied into a table erasure does not cover (0316/0322/0323 cover sessions, day plans, prospects).
sweep: other webhook events carry ids and scores, not transcript text; call.to_crm is the first event whose payload is call content, so it alone gets the ids-only check.
severity: high (a privacy guarantee)

## Final

```
npm run check → first: ✗ tbc:artifacts (check.md not yet written) → written → exit 0 · Test Files 911 passed | 1 skipped · Tests 6702 passed | 15 skipped
```
