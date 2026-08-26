# BUILD — iOS capture webm regression fix

### iOS → mp4 mimetype (the root fix)
- write-path: `useDoorRecorder.ts` — `pickSupportedMimeType` prefers `["audio/mp4","audio/aac","audio/mpeg",...webm]`
  on iOS (via `isIOS()`), webm-first elsewhere. Reverts the 2026-08-23 webm-preference that broke iOS.
- read-path: iOS MediaRecorder now records mp4 (real audio, > 1KB) instead of a webm stub → the capture is viable.

### downstream precondition — mp4 blob named correctly (§1.5.1 layer 2)
- write-path: `DoorLog.tsx` sends `{ kind:"sign", mimeType: audio.blob?.type }`; `door-log/route.ts` SignBody accepts
  `mimeType` and derives the filename via `extForMime` (`pitch.mp4` for mp4, `pitch.webm` default).
- read-path: the stored blob has the right extension so transcription parses mp4, not a mislabeled .webm.

### telemetry un-blinded (§1.2 — the swallowed reason)
- write-path: `door-log/capture-diag/route.ts` — added `capturedBytes` to the zod schema (it was being stripped).
- read-path: `doorlog.capture_failed` events now carry the byte volume → stub vs real-audio-upload-failure is answerable.

### A30 gate
- write-path: `__tests__/pickMime.ios.test.ts` — iOS picks mp4 even when webm is (falsely) reported supported; non-iOS
  keeps webm-first.
- read-path: reintroducing webm-on-iOS fails a test.

## Files
- `src/components/sales-coach/doorlog/useDoorRecorder.ts` — isIOS + iOS mp4 preference (exported for the gate test).
- `src/components/sales-coach/doorlog/DoorLog.tsx` — sign request sends the blob mimeType.
- `src/app/api/coach/sales-session/door-log/route.ts` — SignBody mimeType + extForMime + correct filename.
- `src/app/api/coach/sales-session/door-log/capture-diag/route.ts` — capturedBytes in the schema.
- `src/components/sales-coach/doorlog/__tests__/pickMime.ios.test.ts` — the A30 gate.

## Sweep (A26)
C.A.R.E `useVoiceMode` uses `new MediaRecorder(stream)` (no explicit type → iOS mp4 default, works). live/meeting use
the Scribe realtime socket, not MediaRecorder blobs. Only DoorLog forced webm — the fix is correctly DoorLog-only.

## Ripple (§6 item 5)
Recorder mime + a sign field + the filename + the diag schema. Non-iOS path unchanged (webm). No schema/table change.

## Honest limit
Evidence: live telemetry (root cause), the A30 unit gate, and the downstream filename fix. The DEFINITIVE proof is a
real iOS device now producing a viable mp4 capture — founder field-verify; the re-instrumented capturedBytes will show
it in the telemetry on the next pitch.
