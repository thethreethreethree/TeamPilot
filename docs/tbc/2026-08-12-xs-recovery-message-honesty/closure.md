# CLOSURE — recovery message honesty

## What shipped
The zero-segment transcription message in `SessionRecordingUpload` no longer reads as "your recording was empty"
for what is usually a transcription-SERVICE miss on good audio. Reworded to one honest sentence true for both a
genuinely-silent upload and a service failure, mirroring the founder-approved After-Pitch "didn't connect / your
audio was saved" framing. Serves capture priority #3 (indicate WHY). Copy only.

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS, 0 tenant-pin risks)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs (2 match) · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2744 passed | 15 skipped (2759)
EXITCODE=0
```

## Residual (A36 — ranked; top OPENED)
```json
[
  { "id": "R1", "item": "The message is not unit-tested — it is copy inside a React component the node-env vitest can't render.", "why_skipped": "Standing repo constraint (no jsdom); the string has no logic to extract, and forcing a render harness for one copy line would be over-engineering.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T12:10:00Z", "outcome": "Opened + assessed: accepted. The gate (typecheck + lint + full suite) is green and the founder's visual confirmation on the live surface is the real check for copy. No test claimed that wasn't written (A30 honesty)." },
  { "id": "R2", "item": "The ROOT cause (STT scope env) is unfixed, so recovery attempts still fail until the founder enables the scope — this only makes the FAILURE honest, it doesn't restore capture.", "why_skipped": "The env fix is founder-gated (yours to apply on the ElevenLabs key); the code can't fix a key scope.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T12:11:00Z", "outcome": "Opened + assessed: correct scope split — this build makes the failure signage honest (capture #3); the cure remains the STT-scope env fix, flagged in FOUNDER-ACTION-QUEUE + the Voice/Capture health cards." }
]
```

## Un-named reliance
- Relies on the audio being stamped to storage BEFORE transcription in the finalize path, so "your audio is saved"
  is true for both the fresh-upload and recover-from-saved call sites — verified by reading the finalize/route
  ordering, not a live run.
- Relies on the founder's judgment for final wording — one-line revert if they'd phrase it differently.

## Status
Complete. The prior gate run stopped only on this enforced-path change lacking a TBC dir; this dir closes that.
Commit with the TBC-Build trailer + explicit paths, then push.
