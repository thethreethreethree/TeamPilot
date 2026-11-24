# REMEDIATE - Send to CRM fails loud without webhook signing

### F1 - Send to CRM said "Sent" when the cron could never send
503 with plain words, nothing queued; /api/health reports webhooks.
gate-or-promise: gate (send-to-crm route test)

### F2 - six ledger notes were stale after this week's builds
Corrected in the ledger (v39) with a corrections entry.
gate-or-promise: promise
