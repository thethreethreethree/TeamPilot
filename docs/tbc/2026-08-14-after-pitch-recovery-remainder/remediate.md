# REMEDIATE — After-Pitch recovery remainder (⑥ + ⑧)

## F1 — heal the stale blank on a canonical reload (finding ⑥)
Remediation: the client `autoRecover()` now regenerates the After-Pitch when the route returns `canonical` (the
transcript is already two-sided), healing the old blank a lost post-recovery refresh left behind. Single-fire (the
regenerated read is two-sided → no gap next visit) and no server-side generation → no double-charge.
gate-or-promise: promise. The heal is a client page effect (repo convention: 0 `*.test.tsx`); a browser repro
(recover, drop the client refresh, reload → the read fills in) is the honest confirmation — residual R1.
class: workflow-continuity / error-dressed-as-no-data. severity: medium. Fixed (client wiring).

## F2 — persist the single-voice decline + report it on reload (finding ⑧)
Remediation: a `single-cluster` decline appends a `coach.auto_recover_declined` event; the `already-attempted`
reload branch reads it and returns `still-one-sided`, so the client shows the honest terminal instead of a
re-transcribe card that re-charges STT and dead-ends. Not written for `ambiguous` (retryable).
gate-or-promise: gate. The route test locks: single-cluster persists the decline; a reload with a prior decline
returns still-one-sided (no STT); ambiguous does not persist. Removing the decline read/write reddens CI.
class: recovery-idempotency / honesty. severity: medium. Fixed.
