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
