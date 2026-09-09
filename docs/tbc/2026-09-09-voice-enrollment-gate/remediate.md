# REMEDIATE — adversarial-review findings on slice 1 (same day)

An adversarial correctness/robustness review of the shipped slice (the mic-capture code I could not test with a
real microphone) found four real issues. Three are fixed here; the fourth is resolved by a founder decision.

## Fixed

**F1 (HIGH) — double-start leaked a live AudioContext + mic stream + orphan timer.**
`start()` awaits `getUserMedia` (the permission prompt), during which `phase` isn't yet "recording", so a second
click ran `start()` again and overwrote the audio-graph refs — the first graph stayed live and its timer later
hijacked the second take. Fix: a `startingRef` latch at the top of `start()`, released in `teardown()`.

**F2 (MED-HIGH) — AudioContext/graph construction was outside the try/catch → leaked the live mic.**
Only `getUserMedia` was guarded; if the AudioContext constructor threw (forced sampleRate unsupported, Safari
quirks) the mic stayed live with no error surfaced. Fix: the whole graph build (AudioContext → nodes →
onaudioprocess → timer) is now inside a try/catch that calls `teardown()` + shows an error.

**F3 (MED) — no idempotency on the stop path → double POST.**
The "Done" click racing the `ENOUGH_VOICED` auto-stop could submit twice (two enrollment writes for one take).
Fix: a `stoppedRef` latch makes `stopAndSubmit` fire once; reset at the next `start()`.

## Resolved by decision

**F4 (MED, design) — the enrollment seed was a hard anchor and could INVERT attribution.**
`seedAgentCentroid` set `anchored = true` and trusted the enrolled F0 as ground truth. If the rep's calm
enrollment pitch differs from their animated live pitch by ≥ MIN_CLUSTER_GAP_HZ (25 Hz), the rep's first live
turn seeds the CUSTOMER cluster and the read collapses — worse than the unseeded bootstrap, with no confidence
penalty. Founder decision (2026-09-09): **un-wire the seed** until a self-correcting version is validated. The
`useLiveCoaching` fetch + seed call are removed; `PitchSeparator.seedAgentCentroid` + its tests remain as the
ready primitive for the follow-up. Enrollment + the gate are unchanged; the live bootstrap runs as before, so
enrollment can no longer make attribution worse.

## Verification
`npm run check` re-run green (see check.md's pasted result stands; the fixes are typecheck + logic guards on
browser-glue, which the real-mic test will exercise end-to-end). F4's removal is covered by the existing
attribution tests (bootstrap unchanged) + `seedAgentCentroid`'s own tests (the primitive still works for later).
