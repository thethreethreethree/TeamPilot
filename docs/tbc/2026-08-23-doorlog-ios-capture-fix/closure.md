# CLOSURE — DoorLog iOS zero-audio fix (data-led)

## What shipped
The instrumentation's payoff: 3 real `doorlog.capture_failed` events (all iOS Safari, meaningful durations, the
mic track alive + no recorder error + wake-lock granted) pinned the cause to the **iOS AudioContext-starves-the-
recorder** class. Fixed at the source: the DoorLog sound-bar analyser now runs on a CLONED mic track so
MediaRecorder gets the untouched stream; the recorder picks an explicit `isTypeSupported` mimeType (webm elsewhere,
mp4 on iOS as it already defaults); and `stitchPitchAudio` labels the merged recording with the real content-type
so iOS mp4 isn't handed to STT as webm. Low-downside (iOS was 100% broken; non-iOS webm pipeline unchanged). Full
`npm run check` exit 0; the DoorLog + pitch suites pass unchanged. The `diag-capture-failures` script stays as the
standing confirmation gate.

## The un-named reliance
- **Leading hypothesis, device-confirmed.** The AudioContext conflict is the cause the data FITS, not one a test
  can prove from Node — a real iOS device + the continued diag confirm it. The fix is the safest set for the
  evidence; iOS-already-broken bounds the downside.
- **Chunked-mp4 stitch.** Once iOS delivers data (mp4), the webm-oriented chunk stitch is exercised with mp4 for
  the first time. Ordered concatenation of iOS mp4 fragments + ElevenLabs mp4 tolerance is expected to work (short
  iOS pitches already transcribed), but it's a device-test confirm; the single-blob fallback covers the common case.

## Residual (A36)

```json
[
  {
    "id": "ios-capture-fix-device-confirm",
    "item": "The AudioContext-conflict fix is data-led, not device-proven — a real iOS pitch must confirm audio now captures + the mp4 chunked recording transcribes.",
    "why_skipped": "Can't be tested from Node; the diag stays and a device test confirms. iOS-already-broken bounds the downside.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T07:40:00+08:00",
    "outcome": "Shipped low-downside; confirmation is the next doorlog.capture_failed check + a device pitch."
  },
  {
    "id": "live-meeting-audiocontext-same-class",
    "item": "The live + meeting recorders share the AudioContext-on-mic pattern, but theirs feeds Scribe STT (load-bearing — can't clone it away).",
    "why_skipped": "Data-led: they're now instrumented (coach.capture_failed); if they show the same iOS no-data signature, the fix (a different shape, since the STT feed is essential) follows from that data.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T07:40:00+08:00",
    "outcome": "Flagged + instrumented; not blind-fixed."
  }
]
```
