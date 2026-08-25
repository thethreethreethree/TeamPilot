# BUILD — close the empty-capture detection hole

### the real "was there audio" signal + a shared viability gate
- write-path: `captureDiag.ts` — add `capturedBytes` to `CaptureDiag` + `buildCaptureDiag` (defaults 0); add
  `MIN_VIABLE_AUDIO_BYTES = 1024` and pure `isCaptureViable({blobSize, chunksUploaded})` (chunks uploaded → viable;
  else blob ≥ threshold). `useDoorRecorder.ts` — `capturedBytesRef` summed in `ondataavailable`, reset in `start`,
  passed to `buildCaptureDiag`.
- read-path: the CaptureDiag now records the real captured volume (a 5-byte trailer no longer reads as "audio"),
  and any caller can ask `isCaptureViable` to distinguish a real recording from a truthy-but-empty stub.

### gate the save on viability, not blob existence
- write-path: `DoorLog.tsx` — `hasAudio` now = `isCaptureViable({ blobSize: recorded.blob?.size, chunksUploaded })`
  instead of `!!(recorded.blob || chunksUploaded>0)`. A non-viable capture takes the existing honest no-audio path:
  `reportCaptureFailure(diag)` + `logKnockOutcome(audioDropped)`.
- read-path: an iOS 5-byte stub (chunksUploaded 0, tiny blob) no longer becomes a pitch — the rep sees the honest
  `audioDropped` notice (re-record), the CaptureDiag is recorded (device cause on the record), and NO doomed
  "corrupted" pitch is created. A real recording (chunks, or a KB-scale blob) proceeds to the normal save unchanged.

## Files
- `src/lib/coach/captureDiag.ts` — `capturedBytes`, `MIN_VIABLE_AUDIO_BYTES`, `isCaptureViable`.
- `src/components/sales-coach/doorlog/useDoorRecorder.ts` — track/emit `capturedBytes`.
- `src/components/sales-coach/doorlog/DoorLog.tsx` — viability-gated `hasAudio`.
- tests: `captureDiag.test.ts` (+capturedBytes, +isCaptureViable both branches); 4 DoorLog render mocks updated from
  a 1-byte `Blob(["x"])` stand-in to a realistic 2KB blob (a 1-byte "recording" is not a real recording).

## A26 boundary (class swept)
Class = "recorder treats a non-empty-but-empty capture as success." DoorLog fixed (the doomed-pitch harm site).
`isCaptureViable`/`capturedBytes` live in the SHARED captureDiag module so live/meeting/care can adopt the gate;
they don't mint a pitch from a blob, so they're out of the harm-class today — flagged for reuse (A24), not force-fit.

## Ripple (holistic — §6 item 5)
- Pure helper + one recorder ref + one gate swap; no schema/route/API/migration/external-config change.
- Complements the server honesty guard (4c208231): client stops the doomed pitch at source; server is the backstop.
- Test-mock ripple: the 1-byte blob stand-in was unrealistic; realistic 2KB mocks now represent a real recording.

## Honest limit
This closes the DETECTION hole (warn + record) and stops doomed pitches; it does NOT fix the iOS root cause (why the
capture is empty) — that needs device testing and the telemetry this now records. Also: this reduces the after-pitch
LATENCY tail (empty captures no longer churn retries) but the full latency question is investigated separately.
