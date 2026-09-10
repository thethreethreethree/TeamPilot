# REMEDIATE - a recovery that succeeds and costs something must say what it cost

### F1 - a recovery that dropped the timing reported itself as a plain success
gate-or-promise: gate

`recoverSessionTranscript` now carries the read-back result out as `timingLost` on both
transcript-writing outcomes, and the `/auto-recover` route returns it as a strict boolean. The
mobile client's `reReadRecording` returns `{ status, timingLost }` and the After-Pitch card renders
a plain-language note beside the outcome.

The gate is in the app repository, `tests/customer-missing.test.ts`: named tests assert the note
names what is missing, states the words themselves are all present, does not blame the rep, and
offers no retry for something that cannot be redone. A future edit that turns it into a failure
message, or drops it, fails a named test.

What the gate does NOT cover, stated rather than implied: nothing here fails if a future route
stops SENDING `timingLost`. The client reads `=== true`, so an absent field degrades to "nothing
was lost" - the safe direction for an older server, and a silent one for a regression. The gate on
that side is the type: `RecoveryOutcome` makes the field part of both writing outcomes, so a new
write path that forgets it is a compile error rather than a silent false.

### F2 - the loss is permanent, which is correct, and is what makes the silence worse
gate-or-promise: declined

No gate, and the hole is named. This finding is not a defect to fix - it is the reason F1 matters,
and the behaviour it describes (not releasing the at-most-once marker) is correct and unchanged. A
gate here would have to assert that a deliberate design decision stays made, which is what a code
comment is for and what a test is not.

What IS gated is the consequence: because these calls never come back around, the only moment
anyone could be told is the moment it happens, and F1's gate covers that moment.

### F3 - the on-open web trigger does not match the justification written for it
gate-or-promise: declined

Deliberately not fixed and deliberately not gated, because it is not mine to decide. The change is
one condition on `autoRecover()`; the trade is a rep's words now against that call's timing later,
and CLAUDE.md §6 item 0 is explicit that a choice among courses goes to the founder as a decision
rather than being taken quietly.

It is recorded as residual R1 with the measurement attached - three calls already lost, ledger
still at 0248 - so it is a decision waiting rather than a finding buried. The promise is that it
stays visible: it is on the build board, not only in this document.
