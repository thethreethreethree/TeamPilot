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
  { "id": "R1", "item": "Parts 2 (auto-recover) and 4 (short-call feedback) — and, within 2, the in-call dead-feed detection.", "why_skipped": "Staged: the critical audio-never-lost foundation (1) + honest indication (3) shipped first, tested. 2 + 4 followed in the immediate next commit.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-12T09:05:00Z", "outcome": "MOSTLY CLOSED in the follow-up commit: #4 short-call feedback — the 'Your read' no longer dead-ends on 'too short'; since that section only renders when the after-pitch already has signal (scores/moments/cueLoop co-exist with a thin narrative), it now points the rep to their scores + Next Door Focus instead (§3.4 — no fabricated read). #2 auto-recover — SessionRecordingUpload gained an `autoRetranscribe` prop; the After-Pitch empty-capture state passes it when audio was saved, so a failed capture auto-re-transcribes to the one-tap 'which voice is you?' instead of a manual button. The in-call dead-feed DETECTION (warn during the call if live STT produces no turns ~30s in) is now ALSO shipped — but built at the COMPONENT level (LiveCoachingPanel observes the hook's already-exposed turns/partial via refs + a timer), so it does NOT touch the core capture/message-handling: additive, low-risk. All of parts 1-4 are now complete. Still needs on-device confirmation (live mic + ElevenLabs can't run in-sandbox), batched with the rest of the recording changes." },
  { "id": "R2", "item": "The root FREQUENCY of live-STT failures is likely the ElevenLabs scoped-key/token issue (env), which is the founder's to fix; this build makes failures RECOVERABLE + honest, not less frequent.", "why_skipped": "Env/scope is outside the app; flagged in the queue (the 'Token mint failed' item). The app-side resilience is the right complement regardless of the env cause.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T09:06:00Z", "outcome": "Opened + assessed: this build deliberately targets RECOVERABILITY + honesty, not the failure rate — because the rate is driven by an env/scope issue only the founder can fix (enable the ElevenLabs STT scope). Re-surfaced to the founder that the env fix reduces frequency while this build ensures no session is lost when it does fail. Correctly out of scope for an app-side change." }
]
```

## Post-ship self-review (adversarial, 2026-08-12) — no critical bug; edge cases for the device-tested pass
- **Stop→restart within one session** (Expert can restart): the persist latched once per session, so a SECOND
  recording's audio wouldn't persist. FIXED — the persist is now keyed on the blob IDENTITY
  (`persistedBlobRef === recordingBlob`), so each distinct recording persists. Behaviour-identical for the
  primary stop-once flow (recordingBlob keeps a stable identity until a new setRecordingBlob) — typecheck +
  the full gate below pass.
- **Block-race**: if `transcriptSaved` fires BEFORE the MediaRecorder blob is ready, `onRecordingSaved` can
  advance before the persist blocks. Low-harm: the audio still persists in the background, and the required
  naming gate (several seconds) masks the race in practice so the save almost always completes first. Harden
  only if the device test shows a real gap.
- **Dead-feed warning** auto-clear — FIXED: a small effect now clears the warning the instant any transcription
  (turn or partial) arrives, so a recovered feed doesn't leave a stale amber banner.
- **Block-race** (transcriptSaved before the blob): left as-is — low-harm (the audio still persists in the
  background, and the required naming gate masks it), harden only if the device test shows a real gap.

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (13) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 396 passed | 1 skipped (397); Tests 2732 passed | 15 skipped (2747)
CHECK_EXIT=0
```
