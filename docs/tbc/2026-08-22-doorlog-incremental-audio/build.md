# BUILD — DoorLog incremental (chunked) audio upload + wake lock

### pitch chunk store + stitch (new)
- write-path: `src/lib/coach/doorlog/pitchAudioChunks.ts` — the single-source storage layout
  (`{companyId}/doorlog/{recordingId}/chunks/{seq}.webm` → `.../recording.webm`), `isValidRecordingId`
  (shape-guard, no path smuggling), `recordingIdFromAudioPath` (drives the worker branch), and
  `stitchPitchAudio` (idempotent; reuses `orderedChunkSeqs` + `startsWithEbmlHeader` from the live path's
  `stitchSessionAudio`, so concat semantics can't drift).
- read-path: the worker calls `stitchPitchAudio` then downloads the stitched recording to transcribe.

### chunk-upload route (new)
- write-path: `POST /api/coach/sales-session/door-log/audio-chunk?rid=&seq=` — authenticated + company-scoped,
  shape-validated rid, writes one chunk to the company-pinned path; idempotent on (rid, seq).
- read-path: the recorder POSTs here every ~15s during recording; the worker's stitch reads the results.

### recorder: chunk-during-recording + wake lock
- write-path: `useDoorRecorder.start(recordingId)` uses `rec.start(15000)` timeslice → each `ondataavailable`
  uploads the chunk (1 idempotent retry) AND keeps it for the clean-Stop blob; a screen wake lock is held while
  recording (re-acquired on visibility). `stop()` now returns `chunksUploaded`.
- read-path: `DoorLog` reads `chunksUploaded`/`recordingId` from the recorder to decide the save path.

### DoorLog wiring
- write-path: `recordPitch` mints the recordingId; `save` sends it. `sendPitch` PRIMARY path (chunks landed) POSTs
  `{ kind:"pitch", recordingId }` (no big final upload); FALLBACK (no chunks) is the existing sign+single-blob,
  then knock. `pickOutcome` treats audio as present when a blob OR ≥1 chunk exists (an early-stopped recording is
  saved, not dropped).
- read-path: the RECORDING state is unchanged for the rep; the durability is invisible until it's needed.

### server save
- write-path: `door-log` route `PitchBody` accepts `recordingId` (or the fallback `storagePath`); resolves the
  audio path SERVER-SIDE (never from a client path), creates the pitch pointing at the stitched recording, kicks
  the worker.
- read-path: the worker stitches-then-transcribes for a chunked recording; no-chunks → honest terminal "No audio
  was captured"; a transient stitch error is retryable (the per-minute cron is the backstop).

## Files
- NEW: `pitchAudioChunks.ts`, `door-log/audio-chunk/route.ts` (+ test), `pitchAudioChunks.test.ts`,
  `DoorLogChunkedSave.render.test.tsx`.
- MODIFIED: `useDoorRecorder.ts` (chunk upload + wake lock + chunksUploaded), `DoorLog.tsx` (recordingId, save
  routing, has-audio), `door-log/route.ts` (recordingId → server-resolved audio path), `worker.ts` (stitch-first).

## Reuse
Mirrors the live path exactly and reuses its tested pure helpers (`orderedChunkSeqs`, `startsWithEbmlHeader`).
Additive: the disposition-save and the single-blob fallback are untouched; no schema/migration change (the
recordingId is carried in the audio_path shape, parsed back by the worker).
