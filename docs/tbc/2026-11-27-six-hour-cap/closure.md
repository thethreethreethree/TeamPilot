# CLOSURE - Six-hour cap

## What is true now

A live call stops recording at six hours and the rep sees why; audio sent after that (plus 15 minutes for clock skew)
is refused by the server.

## Residual

```json
[
  {"id": "R1-upload", "item": "An uploaded file is capped by size (100 MB), not by length.", "why_skipped": "An upload's length isn't known before it is transcribed; at typical bitrates 100 MB is about six hours.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T00:04:00Z", "outcome": "Recorded."},
  {"id": "R2-live-check", "item": "Not watched on a real six-hour call.", "why_skipped": "Unit and wiring tests only.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-27T00:04:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

audio_started_at stays set by chunk 0 (0300).

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
