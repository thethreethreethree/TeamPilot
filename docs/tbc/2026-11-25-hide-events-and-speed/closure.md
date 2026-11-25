# CLOSURE - A hidden call's AI reads are hidden too, and the hide checks run once per query

## What is true now

A hidden call's AI summaries, breakdowns and topics are refused like the rest of the call. The hide rules run once per
query, so reading a long transcript is faster than before the hide existed in its per-row form.

## Residual

```json
[
  {"id": "R1-events-company-wide", "item": "events (every call's AI reads) are readable by every company member, not limited by the reporting tree.", "why_skipped": "Pre-existing and wider than the hide; changing it touches every events reader. A founder decision.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-25T11:35:00Z", "outcome": "Flagged to the founder."},
  {"id": "R2-no-timing-gate", "item": "Nothing automated would catch a future per-row hide rule.", "why_skipped": "No query-timing harness in CI.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T11:35:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
