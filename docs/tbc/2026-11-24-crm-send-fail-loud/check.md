# CHECK - Send to CRM fails loud without webhook signing

## Commands

```
curl https://elostate.com/api/health → 200; capabilities: providers {deepseek: true, anthropic: false}, email false, no webhook flag; build commit 2b24dc1
npx vitest run send-to-crm + health + webhooks routes + MacroCallView.render → first: 4 failed (mocks lacked webhooksConfigured; tests had no secret set) → mocks and env fixed → 37 passed
```

## Findings

### F1 - Send to CRM said "Sent" when the cron could never send
class: an external precondition that fails loud in a log nobody reads, silent to the person acting.
sweep: the other webhook entry points — the Protection panel already shows "not configured"; the cron 503s; the four event triggers enqueue from the database (no person waiting on them).
severity: high (a false confirmation)

### F2 - six ledger notes were stale after this week's builds
class: a record not updated when the code it describes changed.
sweep: grep of every ledger note for size caps, webhook events, CRM and notice wording.
severity: low

## Final

```
npm run check → exit 0 · Test Files 920 passed | 1 skipped · Tests 6756 passed | 15 skipped
```
