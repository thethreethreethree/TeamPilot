# CLOSURE — DoorLog capture diagnostics + live mic-death warning

## What shipped
The DoorLog recorder no longer swallows its own failures. It now watches the MediaRecorder `error` event and the
mic track's `ended`/`mute`, warns the rep LIVE the moment the mic dies mid-pitch (so they can recover it), records
a `CaptureDiag` (sawData, mimeType, recorderError, trackEnded/muted, tab-hidden count, wakeLock-granted, duration,
UA), and — on any zero-audio outcome — POSTs it to a new company-pinned `/capture-diag` endpoint that appends a
`doorlog.capture_failed` event. It also resumes the AudioContext on the Record tap so the sound-bar actually
reflects capture on iOS. Full `npm run check` exit 0.

**Why this is the right response to the founder's correction:** I had assumed a stale client; the founder was
right that that's the same assumption-making that caused the problem. This build stops guessing — it makes the
real cause **observable**, warns the rep in the moment, and addresses the likely iOS cause (a dying mic track)
without *asserting* it's the only one. The next real occurrence is diagnosed from data.

## The un-named reliance
- **The recorder's observation code is mic glue** (MediaRecorder/track events) — confirmed on-device, not in
  jsdom. The consumer (warning + diag POST) is tested; the observation itself is field-confirmed.
- **This makes the cause legible; it does not yet name it.** The specific follow-up (e.g. an audible/again louder
  "keep the screen on" affordance, or an audio-session tweak) is deliberately deferred until the
  `doorlog.capture_failed` events show which cause dominates — evidence-led, not another guess.

## Residual (A36)

```json
[
  {
    "id": "capture-blindness-class-other-recorders",
    "item": "The live-sales, meeting, and C.A.R.E-voice recorders share the same capture-blindness shape (no onerror / no mic-track-death detection).",
    "why_skipped": "Scoped to the reported DoorLog P0 (§1.5.2 ship-the-task-file-the-rest). The class + boundary are recorded here for a follow-up sweep.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T04:00:00+08:00",
    "outcome": "DoorLog instrumented; sibling recorders flagged for the same treatment."
  },
  {
    "id": "root-cause-named-after-field-data",
    "item": "The specific dominant cause of zero-audio on reps' devices is not yet named — this build makes it observable, not yet fixed at the source.",
    "why_skipped": "Naming it now without the doorlog.capture_failed data would repeat the assumption the founder corrected. The instrumentation IS the disciplined next step.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-23T04:00:00+08:00",
    "outcome": "Awaiting the first field occurrences; the specific fix follows from the data."
  }
]
```
