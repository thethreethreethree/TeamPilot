# CLOSURE - A time on the next call

## What is true now

A prospect's next call can have a time as well as a date. The pipeline row shows it, the Calendar lists a day's booked
calls in time order with the time, the Ask box sees it, and "Add the next call … to my calendar" makes a 30-minute
event at that time with a reminder 15 minutes before (untimed calls stay all-day). The time is the rep's local time.
Migration 0325 is applied; production has no prospects yet.

## Residual

```json
[
  {"id": "R1-new-prospect-form", "item": "Adding a prospect sets a next call date only; the time is set on the card afterwards.", "why_skipped": "The add form stays short; rss_create_prospect takes a date.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T21:40:00Z", "outcome": "Accepted; recorded here."},
  {"id": "R2-manager-zone", "item": "A manager in another time zone sees the rep's local time without a zone.", "why_skipped": "Reps and their managers usually share a zone; storing a zone is extra.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T21:40:00Z", "outcome": "Accepted; recorded here."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
