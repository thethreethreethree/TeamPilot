# CLOSURE - Tracker start and end dates

## What is true now

A tracker can have an optional start and end date: it counts only on calls that started between them, a future start
shows as scheduled, and a smart tracker with a past start reads back calls from that date.

## Residual

```json
[
  {"id": "R1-keyword-backfill", "item": "A keyword tracker with a past start date isn't read back automatically; the existing 'scan recent calls' button reads the last 50.", "why_skipped": "Unchanged keyword flow; the scan applies the dates.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T22:22:00Z", "outcome": "Accepted."},
  {"id": "R2-utc-days", "item": "Dates are UTC calendar days, not the company's time zone.", "why_skipped": "There is no company time zone setting.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T22:22:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
