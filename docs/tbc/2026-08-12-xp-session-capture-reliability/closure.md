# CLOSURE — session capture reliability (parts 1 + 3)

## What shipped
The live-recorded audio is now persisted to Storage the instant recording stops — before any navigation — so a
call whose live STT captured nothing is never lost and is always re-transcribable. A blocking "Saving
recording…" state guarantees the audio is safe before the app advances to After-Pitch (founder's choice), and
After-Pitch now honestly distinguishes "transcription didn't connect, your audio was saved, recover it" from
"nothing was recorded". This addresses the founder's first-client incident (parts 1 immediate-fix + 3
indication). Founder-authorized approach (AskUserQuestion 2026-08-12: block + all four).

## Un-named reliances (A35)
- **The persist is best-effort + additive.** It runs as a new side-effect on Stop; the live capture/finalize
  happy path is untouched, so the fix can't break a session where live STT works.
- **The blocking advance won't trap the rep.** It fires once the persist SETTLES (saved OR failed) and is 60s
  timeout-bounded; on failure the manual upload + re-transcribe remain.
- **Runtime verification deferred to the founder's device test.** Live recording + ElevenLabs need real
  hardware/keys not available in this sandbox; the persistOnly route branch + the recovery-contract are unit-
  tested, the flow mirrors the proven upload path, and the change is additive — but the end-to-end (record →
  STT fails → audio saved → recover) must be confirmed on the founder's/tester's device.

## Residual (A36 — ranked by confidence-it-does-not-matter; top OPENED)
```json
[
  { "id": "R1", "item": "Parts 2 (auto-recover: auto-re-transcribe when the transcript is empty but audio is saved; detect a dead live feed DURING the call) and 4 (give feedback whenever audio exists, instead of the 'too short to read' dead-end) are NOT in this build.", "why_skipped": "Staged: the critical audio-never-lost foundation (1) + honest indication (3) ship first, tested, rather than one giant untested change to the core recording pipeline for the #1 client. 2 + 4 follow immediately.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-12T09:05:00Z", "outcome": "Opened: these are the next commits. #2 auto-recover reduces the recovery to zero taps for the common failure; #4 is a separate concern (a SHORT but successful call gets 'too short to read') needing a narrative-generation threshold change. Both queued as the immediate follow-up; the founder was told the delivery is staged." },
  { "id": "R2", "item": "The root FREQUENCY of live-STT failures is likely the ElevenLabs scoped-key/token issue (env), which is the founder's to fix; this build makes failures RECOVERABLE + honest, not less frequent.", "why_skipped": "Env/scope is outside the app; flagged in the queue (the 'Token mint failed' item). The app-side resilience is the right complement regardless of the env cause.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T09:06:00Z", "outcome": "Opened + assessed: this build deliberately targets RECOVERABILITY + honesty, not the failure rate — because the rate is driven by an env/scope issue only the founder can fix (enable the ElevenLabs STT scope). Re-surfaced to the founder that the env fix reduces frequency while this build ensures no session is lost when it does fail. Correctly out of scope for an app-side change." }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (13) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 396 passed | 1 skipped (397); Tests 2732 passed | 15 skipped (2747)
CHECK_EXIT=0
```
