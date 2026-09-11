# REMEDIATE - a session should be dated when the conversation happened

### F1 - a session recorded days ago was dated the day it finally uploaded
gate-or-promise: gate

`createSession` takes an optional `startedAt` and omits the column when it is absent; the route
accepts the field and passes it through `sessionStartedAt`; the app sends `rec.recordedAt`.

The gate is `src/lib/coach/v5/__tests__/sessionStartedAt.test.ts` - nine tests, and the one that
matters most asserts a seven-day-old recording is BELIEVED, because a fix that refused real
backdated recordings would restore the defect while looking careful.

What the gate does not cover, named rather than implied: nothing fails if the APP stops sending
`startedAt`. The field is optional by design - a web caller must not send one - so its absence is
indistinguishable from a caller that has not been updated. The protection there is that the app's
own upload path is exercised by its suite, not by this one.

### F2 - it was masked by a different defect
gate-or-promise: declined

No gate. This is an observation about the ORDER in which two faults became visible, not a behaviour
that can regress. Gating it would mean asserting that one defect no longer hides another, which is
not a property any test can hold.

What is gated is the consequence: F1's tests fail if the dating regresses, whether or not anything
is hiding it.

### F3 - the fix's own input cannot be trusted
gate-or-promise: gate

Both bounds are pinned, and so is the REASON for the backward one: a test asserts the window
exceeds the measured 47-day worst case rather than asserting the bare number, so a future edit that
tightens it below a real recording's wait fails with the measurement in the message.

Proven by mutation - trusting a future timestamp, trusting any backdate, and shrinking the window
to 30 days each fail exactly one named test, and each failure names what it is about.
