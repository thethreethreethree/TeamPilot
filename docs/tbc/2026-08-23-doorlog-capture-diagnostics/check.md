# CHECK — DoorLog capture diagnostics + live mic-death warning

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  562 passed | 1 skipped (563)
      Tests  3694 passed | 15 skipped (3709)
EXIT: 0
```

(Targeted: capture-diag route 4, DoorLogCaptureDiag.render 2, full DoorLog suite 9 files pass.)

## What the tests prove
- **Endpoint gate:** capture-diag requires auth (401), a company context (403), a bounded/valid diag body (400 on
  garbage), and on success appends a `doorlog.capture_failed` event with `company_id` PINNED to the caller (INV15)
  + the diag payload.
- **Live warning:** when `recorder.captureInterrupted` is true during recording, DoorLog shows the honest "mic
  stopped" warning so the rep can recover the pitch.
- **Diagnostics reported:** a pitch that records NO audio POSTs the recorder's ground-truth diag to capture-diag
  (trackEnded / sawData:false / UA on the record) — the cause is captured, not assumed.
- **No regression:** the full DoorLog suite (9 files) still passes with the new `stop()` return shape.

## Honest limit
The recorder's own observation code (MediaRecorder onerror + track `ended`/`mute` handlers) is mic glue — it runs
on-device, not in jsdom; the render tests exercise the CONSUMER (warning + diag POST) with a mocked recorder. The
FIRST real field occurrence with this shipped is what confirms the actual cause (the whole point) — this build
makes that occurrence legible; it does not itself prove which cause dominates.

## Findings
**No findings.** Additive; save path unchanged; endpoint auth+company-pinned; best-effort telemetry. Class
recorded (A26): the live/meeting/CARE recorders share the capture-blindness shape — a follow-up, not this P0.
