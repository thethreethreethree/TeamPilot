# REMEDIATE - Coaching export

### F1 - req.nextUrl in a route whose tests pass a plain Request
Fixed: new URL(req.url).
gate-or-promise: gate (export.test.ts calls the route with a plain Request)

### F2 - no monthly coaching email
gate-or-promise: promise (OPEN.md "monthly coaching email to managers")

## Addendum 2026-11-23 — F2 closed by decision
The monthly coaching email is not built: D10 (founder 2026-11-22) makes manager alerts in-app only, and the weekly
managers' email was switched off for it (weekly-digest-cron, MANAGER_DIGEST_EMAIL). Building a monthly managers' email
would overtake that decision (§3.3, §6). Reopen only if D10 changes.
gate-or-promise: promise (OPEN.md entry closed with the reason)
