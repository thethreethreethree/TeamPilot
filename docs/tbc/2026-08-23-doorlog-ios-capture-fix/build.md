# BUILD — DoorLog iOS zero-audio fix

### the analyser no longer starves the recorder (iOS AudioContext conflict)
- write-path: `useDoorRecorder.arm()` builds the sound-bar analyser on a CLONED mic track
  (`stream.getAudioTracks()[0].clone()`) in its own MediaStream, so MediaRecorder records the untouched stream.
  Falls back to the original stream if `clone` is unavailable. The cloned track is stopped in teardown.
- read-path: the sound bar still animates (same analyser, cloned source); on iOS the recorder now actually
  receives audio instead of silence.

### explicit, verified mimeType
- write-path: `pickSupportedMimeType()` returns the first `MediaRecorder.isTypeSupported` of
  webm(opus)→webm→mp4→aac→mpeg; `start()` constructs `new MediaRecorder(stream, { mimeType })`. Non-iOS resolves
  to webm (pipeline unchanged); iOS to `audio/mp4` (its default anyway). The real `rec.mimeType` is captured for
  the diag.
- read-path: the recording is produced in a codec the browser can actually encode — no silent no-data start.

### honest stitched content-type (server ripple)
- write-path: `stitchPitchAudio` now labels the merged recording with the chunks' ACTUAL content-type (from the
  first chunk's `downloadAssetBytes` contentType) instead of a hardcoded `audio/webm`.
- read-path: the worker reads that content-type back (`dl.contentType`) and hands STT the correct format — iOS
  mp4 is no longer mislabeled as webm.

## Files
- `src/components/sales-coach/doorlog/useDoorRecorder.ts` — cloned-track analyser + `analyserStreamRef` teardown;
  `pickSupportedMimeType` + explicit MediaRecorder mimeType.
- `src/lib/coach/doorlog/pitchAudioChunks.ts` — preserve the real content-type in the stitched recording.

## Ripple (holistic)
Low-DOWNSIDE: iOS is currently 100% no-audio, so an iOS-path change can only improve it; non-iOS stays webm
(unchanged). The DoorLog render tests mock the recorder (this is device-confirmed mic glue), so they + the pitch
stitch tests still pass. Scoped to DoorLog; live/meeting share the pattern but their AudioContext feeds Scribe STT
(load-bearing) — flagged + instrumented, not blind-fixed. Chunked-mp4 concatenation is the device-test confirm.
