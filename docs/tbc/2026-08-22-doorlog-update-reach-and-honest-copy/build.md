# BUILD — DoorLog update-reach + honest audio-dropped copy

### recording-active flag (reach safety)
- write-path: `useDoorRecorder` sets `document.body.dataset.recording = "1"` on start, clears it on stop +
  teardown.
- read-path: `VersionWatcher.isRecordingActive()` already reads this flag → it can never auto-reload during a
  DoorLog pitch (the same protection the live-coaching recorder has).

### safe-to-update checkpoint (reach)
- write-path: `DoorLog` dispatches `window` event `elostate:safe-to-update` when `state` transitions back to
  IDLE after a door (a `useRef` tracks the previous state; the initial idle mount does not fire).
- read-path: `VersionWatcher` listens and calls `check(true, true)` — a fresh throttle-bypassed staleness check
  that auto-reloads IF stale (recording-guard + once-per-commit loop-guard still apply). A stale active rep now
  updates at the next between-doors gap instead of hours later.

### honest audio-dropped copy (M1)
- write-path: `sendPitch` computes `dropReason` on the knock fallback — `upload_failed` when a blob OR ≥1 chunk
  existed (the rep recorded; the upload/stitch failed), else `no_capture`; returns it alongside `audioDropped`.
- read-path: `save()` and `logKnockOutcome()` render `audioDroppedMessage(reason)` — "the recording couldn't be
  saved this time (weak signal)" vs "no audio was recorded" — instead of the old blanket "recorded no audio".

## Files
- `src/components/sales-coach/doorlog/useDoorRecorder.ts` — `data-recording` flag on start/stop/teardown.
- `src/components/sales-coach/doorlog/DoorLog.tsx` — `elostate:safe-to-update` on idle-return; `DropReason` +
  `audioDroppedMessage`; sendPitch returns the reason; save/logKnockOutcome use it.
- `src/components/system/VersionWatcher.tsx` — listen for `elostate:safe-to-update` → `check(true, true)`.
- `src/components/sales-coach/doorlog/__tests__/DoorLogUploadFallback.render.test.tsx` — NEW: upload-fail → knock
  + "recording couldn't be saved" (not "no audio").
- `src/components/sales-coach/doorlog/__tests__/DoorLogCaptureLoss.render.test.tsx` — updated no_capture copy.

## Reuse
Reuses VersionWatcher's existing recording-guard, loop-guard, and `check()`/`scheduleReload()` machinery — the
new listener is one line mirroring `elostate:recording-ended`. No new update logic, no server change.
