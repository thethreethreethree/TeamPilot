# CLOSURE — finance deliver-cron recorder guard

## What shipped
The scheduled-report delivery cron's per-item bookkeeping is now resilient: a throw from
`fin_record_report_delivery` (recording either a `'sent'` or a `'failed'` outcome) is contained to its own
item and logged, instead of propagating out of the loop and aborting every delivery scheduled after it. A
delivered report can also no longer be mis-recorded as `'failed'` if its success-record write happens to throw.

## Un-named reliance (not self-evident)
- **The cron is 503-dormant** until `CRON_SECRET` is set in Vercel env (the header documents this as a
  deliberate operator step). So this is a hardening of a path that does not run in production today — it
  matters the moment the founder activates scheduled reports, not before. No live behavior changed.
- **This depends on `sendPushToUsers` and the Supabase rpc being the ONLY throwing calls in the loop.** They
  are, as of this change; if a future edit adds another `await` that can throw between items, it would need the
  same containment. The invariant to preserve: *nothing in the per-item loop body may throw out of the `for`* —
  a per-item failure must stay per-item, because this cron's whole reason to exist is that a silent stop is
  worse than a visible one.
- **Not converted to a structural guard.** A route-level test would need to mock the admin client + push
  sender to throw; for a dormant, low-severity path that was judged disproportionate this pass. The invariant
  above is recorded here instead so a future edit has the reason in the tree.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No live end-to-end run — only the mocked route test (commit b25166b0) and typecheck cover the batch-resilience behavior.", "why_skipped": "Cron is 503-dormant until CRON_SECRET; the mocked test drives a recorder throw and asserts all recipients are still attempted.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-02T00:40:00Z", "outcome": "OPENED — the test forces a throw on the 2nd item's recorder and asserts sendPushToUsers is called 3 times + status 200; the batch-abort regression is locked." },
  { "id": "RES-02", "item": "The 'nothing in the per-item loop may throw out of the for' invariant is recorded in prose (closure) but not enforced by a structural guard.", "why_skipped": "A lint/AST rule for this shape is fragile; the mocked test covers the current code, and the reasoning is in the tree for the next editor.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null }
]
```
