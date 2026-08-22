# BUILD — DoorLog capture diagnostics + live mic-death warning

### the recorder now observes + reports why capture failed (no more silent swallow)
- write-path: `useDoorRecorder` adds `rec.onerror` (records the MediaRecorder error), watches the mic track's
  `ended`/`mute`/`unmute`, tracks whether `ondataavailable` ever fired, the chosen `mimeType`, tab-hidden count
  during recording, and whether the wake lock was granted. `stop()` returns a `CaptureDiag` with all of it. On the
  Record tap it resumes the AudioContext (a fresh one is SUSPENDED on iOS → the sound-bar was misleadingly flat).
- read-path: DoorLog renders a LIVE red warning in the recording screen when `recorder.captureInterrupted` (the
  mic track died) so the rep can recover the pitch in the moment; and on a zero-audio outcome it POSTs the
  `CaptureDiag` to `/capture-diag`, which appends a `doorlog.capture_failed` event — queryable ground truth.

### the diagnostics endpoint
- write-path: `POST /api/coach/sales-session/door-log/capture-diag` — authenticated + company-PINNED (INV15: the
  event's `company_id` is the caller's own, never client-supplied), a zod-bounded diag body, appends to `events`.
- read-path: the founder can query `events where kind = 'doorlog.capture_failed'` to see the real cause per
  occurrence (mic track ended/muted, recorder error, tab hidden, wake-lock denied, mimeType, duration, UA).

## Files
- `src/components/sales-coach/doorlog/useDoorRecorder.ts` — `CaptureDiag` type + `captureInterrupted` state +
  onerror/track-death detection + AudioContext resume + richer `stop()`.
- `src/components/sales-coach/doorlog/DoorLog.tsx` — live warning; `reportCaptureFailure` POST on no-audio; `diag`
  threaded through the `recorded` state.
- `src/app/api/coach/sales-session/door-log/capture-diag/route.ts` — the new endpoint (NEW).
- tests: `capture-diag/__tests__/route.test.ts` (4 — auth/company-pin/validation/insert); `DoorLogCaptureDiag.render.test.tsx`
  (2 — live warning shows; diag POSTed on no-audio).

## Ripple (§1.5)
Additive. The blob/chunk/save path is byte-unchanged; `stop()`'s new `diag` field updated every caller + mock. No
schema change (reuses `events`). Best-effort telemetry — a diag failure never touches the rep's flow (keepalive +
swallowed catch, and the endpoint returns 200 even on an insert error).
