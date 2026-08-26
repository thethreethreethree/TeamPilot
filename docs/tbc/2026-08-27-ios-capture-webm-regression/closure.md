# CLOSURE — iOS capture webm regression fix (P0)

## What shipped
The real fix for the recurring iOS "no audio was recorded". Live telemetry showed 100% of empty captures were iOS 18.7
recording as `audio/webm;codecs=opus` and producing a sub-1KB stub — iOS Safari 18.x falsely reports webm support, and
my 2026-08-23 webm-preference made iOS pick it. Now iOS records mp4 (which it actually encodes); the fallback upload
names the file by its real type so mp4 parses in transcription; and `capturedBytes` is restored to the telemetry so the
byte volume is on the record. The class was swept (C.A.R.E + live/meeting unaffected) and the lesson is gated.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Root cause from live `doorlog.capture_failed` telemetry; A30 gate locks
mp4-on-iOS; existing recorder tests pass.

## The un-named reliance
- **The definitive proof is a real iOS device producing a viable mp4 capture** — I can't run iOS Safari MediaRecorder
  here. The mime selection is gated, the downstream filename is fixed, and the re-instrumented `capturedBytes` will show
  real audio on the next real pitch. Founder field-verify, and the telemetry now answers it with data if it recurs.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The chunked (durable) upload path stays webm-native; on iOS only the fallback whole-blob (mp4) carries audio.",
    "why_skipped": "iOS ignores MediaRecorder timeslice, so it never produced usable periodic chunks anyway — the fallback whole-blob is the path that works on iOS, and it now carries a valid mp4. Making chunked mp4 stitch is a larger change with no iOS benefit today.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T07:35:00+08:00",
    "outcome": "OPENED + bounded: iOS audio persists via the fallback mp4 blob; chunked-mp4 is unnecessary for iOS, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "Older iOS sessions already recorded as webm stubs have no recoverable audio.",
    "why_skipped": "Their audio never existed (stub) — nothing to recover. Going forward, iOS captures real mp4. The view-session usage fix already surfaces those sessions as activity regardless of audio.",
    "confidence_it_does_not_matter": "high",
    "opened_at": null
  }
]
```
