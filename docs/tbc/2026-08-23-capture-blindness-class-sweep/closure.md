# CLOSURE — Capture-blindness class sweep

## What shipped
The capture-blindness class the DoorLog P0 named — a recorder that discards its own failure signal — is now swept
across the other three MediaRecorder surfaces. `useLiveCoaching`, `useMeetingCoaching`, and `useVoiceMode` (C.A.R.E)
each add a `MediaRecorder.onerror` handler and mic-track `ended`/`mute` detection, and report a `coach.capture_failed`
event (via the shared `captureDiag` primitive + a new company-pinned `/api/coach/capture-diag` endpoint) when a
meaningful session captures nothing. The live path flips its existing honest "not recording" banner off the moment
the mic dies (not only at Stop); C.A.R.E surfaces a deaf-call that previously re-armed forever in silence. No cause
is asserted — every recorder's failure is now OBSERVABLE. Additive; no schema change; every existing recorder suite
passes. Full `npm run check` exit 0.

**With this, the capture-blindness class (A26) is closed across all four recorders** (DoorLog `a9402dcb` + these
three). The next step is data-led: as `doorlog.capture_failed` / `coach.capture_failed` events land, the dominant
cause per surface names the specific source fix.

## The un-named reliance
- **The observation code is mic glue** (MediaRecorder/track events) — confirmed on-device, not in jsdom; the shared
  primitive + endpoint are the tested gates.
- **C.A.R.E diags omit the conversation id** — the id isn't reliably in scope at the stream-setup site, and I would
  not risk a wrong variable in a live subsystem; the event is subject `rep:<user>` + `surface:"care"` (still
  filterable). Adding the conversation id is a safe follow-up once its plumbing is confirmed.

## Residual (A36)

```json
[
  {
    "id": "care-diag-no-conversation-id",
    "item": "C.A.R.E capture diagnostics report subject rep:<user>, not the conversation, because the conversation id isn't reliably in scope at the stream-setup site.",
    "why_skipped": "Referencing a wrong variable in the live C.A.R.E turn loop is a real regression risk; surface+rep is enough to see care capture failures. Plumb the id in a follow-up once confirmed.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T04:12:00+08:00",
    "outcome": "care capture failures are recorded, filterable by surface; conversation-level attribution deferred."
  },
  {
    "id": "dominant-cause-still-data-led",
    "item": "Which failure cause dominates per surface is not yet named — this sweep makes all four recorders observable, not yet fixed at the source.",
    "why_skipped": "Naming it without the events would repeat the assumption the founder corrected. The instrumentation IS the disciplined step.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-23T04:12:00+08:00",
    "outcome": "Awaiting field events across all surfaces; the specific fixes follow from the data."
  }
]
```
