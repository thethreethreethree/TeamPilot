# CLOSURE - Idempotency-Key

## What is true now

A tool that retries POST /api/v1/calls with the same Idempotency-Key within 24 hours gets the first call back; no second
call or transcription is made.

## Residual

```json
[
  {"id": "R1-simultaneous", "item": "Two requests with the same key at the same instant can both make a call.", "why_skipped": "Retries come after a timeout, not at once; both count toward the cap.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T02:38:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
