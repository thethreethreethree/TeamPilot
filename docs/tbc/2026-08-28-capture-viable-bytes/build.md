# BUILD — capture viability on byte volume

### isCaptureViable gates on capturedBytes (authoritative when known)
- write-path: `captureDiag.ts isCaptureViable` gains `capturedBytes?`; when non-null it is authoritative
  (viable iff `>= MIN_VIABLE_AUDIO_BYTES` 1KB); else falls back to the old chunk/blob signals.
- read-path: a stub that streamed a chunk (chunksUploaded>0) but carried < 1KB of audio is now correctly NOT viable.

### DoorLog passes the real signal
- write-path: `DoorLog.tsx` passes `capturedBytes: recorded.diag.capturedBytes` (tracked per-recording in
  useDoorRecorder, reset on start, summed on each non-zero dataavailable).
- read-path: an iOS 5-byte stub → not viable → the outcome is logged as a knock (audioDropped) with an honest
  capture-failed heads-up, instead of a doomed "corrupted" pitch. Real recordings (KB+) are unaffected.

## Files
- `src/lib/coach/captureDiag.ts` — isCaptureViable capturedBytes authority
- `src/components/sales-coach/doorlog/DoorLog.tsx` — pass capturedBytes at the viability gate + corrected comment
- `src/lib/coach/__tests__/captureDiag.test.ts` — +3 cases (reject streamed stub, keep real, fallback)

## Ripple (§6 item 5)
- DoorLog is the ONLY isCaptureViable caller (grep-verified) — blast radius is the door-pitch flow. The change is
  backward-compatible (fallback when capturedBytes unknown), so the pure function is safe for any future caller.
- No schema/API change. The failed-pitch pollution of the pitch list + the door KPIs stops (stubs no longer become
  pitches); a rep's OUTCOME is still captured as a knock, so no sale/outcome is lost.

## Honest limit (verify)
- This fixes the SYMPTOM (no doomed pitches; honest failure). The ROOT cause — why iOS produces the stub (webm-vs-
  mp4 format; failures are .webm despite the "iOS records mp4" comment) — is NOT fixed here; a rep on the affected
  path still can't capture until that's addressed (critical residual R1).
- The live effect (an iOS stub now yielding a re-record instead of a pitch) is founder visual-verify on a real
  device; the pure-function gate + the capturedBytes plumbing are unit-gated + typechecked.
