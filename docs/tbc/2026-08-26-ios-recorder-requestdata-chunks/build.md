# BUILD — iOS empty-capture ROOT: force chunks via requestData()

### the chunk-forcing interval (iOS timeslice is ignored)
- write-path: `useDoorRecorder.ts` — new `chunkForceRef` interval (+ `lastDataAtRef`). `ondataavailable` stamps
  `lastDataAt`. `start()` creates an interval every `AUDIO_CHUNK_MS` that, if no data arrived in the last window,
  calls `rec.requestData()` (try/catch — a no-op where unsupported). Cleared in `stop()` + teardown.
- read-path: on iOS Safari (timeslice never fires), the interval forces a webm continuation chunk from ~15s on →
  `uploadChunk` runs during recording → partial audio is durable, surviving a mid-pitch mic-track end. On
  Chrome/Android, `lastDataAt` stays fresh (timeslice delivers) so the force is a no-op. `requestData()` flushes only
  the DELTA, so a chunk forced right after a real chunk is near-empty — never a duplicate.

## Files
- `src/components/sales-coach/doorlog/useDoorRecorder.ts` — chunk-forcing interval + lastDataAt; cleared on stop/teardown.
- `src/components/sales-coach/doorlog/__tests__/useDoorRecorder.iosChunks.test.ts` — gates the force-on-silent-timeslice behavior.
- `scripts/diag-capture-live.mjs` — READ-ONLY telemetry reader that produced the 12/12-iOS ground truth.

## Diagnosis provenance (§5 / instrument-don't-assume)
`diag-capture-live.mjs` over the shipped `doorlog.capture_failed` events (last 48h): 12/12 iOS, all
`chunksUploaded=0`, `mimeType=audio/webm;codecs=opus`, `trackReadyState=ended` on the long recordings. The fix
targets THAT, not a guess (my earlier mp4 theory was refuted by this same telemetry).

## Ripple (holistic — §6 item 5)
- Recorder-only change; the chunk-upload endpoint + server stitch already consume these chunks (no server change).
- Non-iOS unaffected (adaptive threshold). Clean-Stop full-blob fallback unchanged. Interval cleared on stop/teardown
  (no leak). 23 existing doorlog tests still pass.

## A26 note
Sole timeslice consumer for the Door Log recorder is this hook. The live/meeting recorders are a separate path
(their own AudioContext-to-STT design) and are out of this fix's scope — flagged if the same iOS symptom appears there.

## Honest limit
jsdom can't reproduce iOS's timeslice bug — the unit test gates the interval logic; the AUTHORITATIVE proof is a live
iOS 18.7 device, which the founder is on right now. The iOS mic-track-END cause (why the track dies mid-pitch) is a
separate device-gated investigation; this fix makes the audio durable regardless of that cause.
