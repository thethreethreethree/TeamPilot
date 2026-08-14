# REMEDIATE — After-Pitch first-visit recovery + transient-failure marker release

## F1 — engage auto-recover from the freshly-generated summary on first visit
Remediation: `generate()` returns the fresh summary; the `load()` heal branch (which handles the null-summary
first visit) now, after generating, engages `autoRecover()` when the FRESH summary is the recoverable
customer-missing gap (saved audio, non-video, latch free). The Standard rep reaches a recovered two-sided read on
first view instead of a stranded blank. Uses the existing, tested `afterPitchNeedsAutoRecover` predicate.
gate-or-promise: promise. The wiring is in a client page effect (repo convention: 0 `*.test.tsx`); the PREDICATE
it depends on is gated (`captureGap.test.ts:52`), but the end-to-end first-visit engage is verified by a browser
repro — noted as residual R1. (Honest: this half is a promise, not a CI gate.)
class: workflow-continuity / error-dressed-as-no-data. severity: high. Fixed (client wiring).

## F2 — release the marker on a transient replace failure
Remediation: `await releaseMarker()` before the replace-failure 500, so a rolled-back DB write (transcript
intact) allows a later retry instead of permanently burning recovery — matching the route's own
transient-vs-definitive doctrine and the download/STT 502 paths.
gate-or-promise: gate. `auto-recover/__tests__/route.test.ts` asserts `markerWasReleased()` on the replace-failure
path — removing the release fails CI.
class: recovery-idempotency / transient-vs-definitive. severity: medium. Fixed.
