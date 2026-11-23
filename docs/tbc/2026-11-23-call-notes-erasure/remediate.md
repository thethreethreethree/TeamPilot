# REMEDIATE - Call notes, and erasure that reaches every copy of a customer's words

### F1 - erasing a customer left their words in tables created after 0285
Fixed in 0316 and proven by the replay; applied.
gate-or-promise: gate (src/lib/__tests__/erasureCoverage.test.ts; invariant 38's extension list)

### F2 - practice scenarios built from a call may describe the customer
gate-or-promise: promise (OPEN.md founder decision: should erasure retire scenarios built from an erased call?)

## Addendum 2026-11-23 — F2 decided and done
Founder picker: "Retire them". 0317 adds to rss_erase_sessions: retire training_scenarios whose source_session_id is an
erased call (the one change 0282's guard allows). Replay: the erased call's scenario retired, the other call's not.
Applied; production's function contains the step. Invariant 38 names 0317 as an extension.
gate-or-promise: gate (erasureCoverage.test.ts; invariant 38 extension list)
