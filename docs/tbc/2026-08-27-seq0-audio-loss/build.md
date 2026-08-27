# BUILD — seq-0 header-chunk-loss fix

### Track the header chunk's real upload outcome
- write-path: `useDoorRecorder.ts` — `seq0OkRef` (a `useRef`) set true only when the `seq === 0` chunk's upload `ok()`
  fires; reset to false in `start()`. `stop()`'s return type gains `seq0Uploaded: boolean`, threaded through all three
  resolve() sites.
- read-path: the caller learns whether the CONTIGUOUS-FROM-HEADER stitch is actually possible, not just whether *some*
  chunk landed.

### Gate the stitch path on the header, not any-chunk
- write-path: `DoorLog.tsx` — `recorded` state + `sendPitch(audio)` gain `seq0Uploaded`; the durable-path gate changes
  from `audio.chunksUploaded > 0 && audio.recordingId` to `audio.chunksUploaded > 0 && audio.seq0Uploaded &&
  audio.recordingId`. When seq 0 was lost but later chunks uploaded, the condition is false → the existing single-blob
  fallback (sign + upload the local clean-Stop blob, which HAS the header) runs instead of a doomed stitch.
- read-path: audio is preserved in the seq-0-loss case that previously terminalized as "no audio recorded".

### Gate the lesson (A30)
- write-path: `useDoorRecorder.iosChunks.test.ts` — two tests: seq0Uploaded is TRUE when the seq-0 upload succeeds;
  FALSE when the seq-0 upload fails (fetch mock rejects `?seq=0`, both attempts) even though a later chunk uploads.
- read-path: a regression that drops the seq-0 distinction (goes back to any-chunk) fails the FALSE-branch test.

## Files
- `src/components/sales-coach/doorlog/useDoorRecorder.ts` — seq0OkRef + seq0Uploaded on stop().
- `src/components/sales-coach/doorlog/DoorLog.tsx` — seq0Uploaded state/signature + gate term.
- `src/components/sales-coach/doorlog/__tests__/useDoorRecorder.iosChunks.test.ts` — 2 seq-0 gate tests.
- `src/components/sales-coach/doorlog/__tests__/DoorLogChunkedSave.render.test.tsx` — mock now returns seq0Uploaded:true (a fully-successful stream includes the header).
- `src/components/sales-coach/doorlog/__tests__/DoorLogViewResult.render.test.tsx` — same honest-mock update.

## Ripple (§6 item 5)
No server/schema/API change. The blob fallback path already existed and is exercised; this fix only routes to it in
one more (previously-lost) case. The `stop()` tuple's only consumer is the DoorLog caller (checked).

## Honest limit
The recorder tests mock `fetch` per-seq in jsdom — they lock the client ROUTING logic (which path the caller takes),
not live storage or a real MediaRecorder. The live proof of end-to-end capture is the founder's iPhone field test plus
`diag-capture-live.mjs`.
