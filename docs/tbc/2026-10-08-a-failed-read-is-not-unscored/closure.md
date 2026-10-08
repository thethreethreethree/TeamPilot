# CLOSURE - a failed read is not an unscored pitch

## What is true now

A pitch-score read that fails is reported as a failure, so the panel says it could not load the score instead of
offering to re-score a pitch that may already be scored. This closes R2-null-return-sweep of
docs/tbc/2026-09-30-a-failed-save-says-why.

## Residual

```json
[
  {
    "id": "R1-recording-detail-404",
    "item": "readPitchRecordingDetail answers 404 for a read error as well as for not-found.",
    "why_skipped": "Deliberately indistinguishable from not-yours, and no paid action follows from it.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-10-08T18:10:00Z",
    "outcome": "OPEN, by design."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
