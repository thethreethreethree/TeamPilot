# REMEDIATE - Message adoption on trackers

### F1 - a capped read of hits could undercount adoption
Fixed: paged reads.
gate-or-promise: gate (route test reads through the paged path; a failed read is a 500)

### F2 - no adoption goal per message
gate-or-promise: promise (OPEN.md "adoption goals per tracker")

## Addendum 2026-11-23 — F2 done (adoption goals, ledger F18.3)
0318 tracker_goals (append-only; latest row wins; a row with no target clears). Managers set "said in at least / at most
N% of calls" in the Adoption view; it shows "on target" or "not there yet" against the actual share. PUT on the adoption
route (requireSalesCoachManager + company-pinned tracker check); invariant 36 allowlist entry with its reason.
gate-or-promise: gate (adoption.test.ts goal rules; adoption route tests for PUT)
