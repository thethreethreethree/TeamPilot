# CLOSURE - Team call calendar

## What is true now

Remote Sales → Pipeline has a Calendar view: one week, Monday first, with each day's booked calls (a prospect's next
call date) and held calls (recorded calls, at the viewer's own local time, with outcome). A manager switches "Whose
pipeline" to see one report's week or the whole team's, with names on each entry. A booked call opens the prospect; a
held call opens the call. If anything fails to load, it says so and offers Try again — never an empty week. The Ask box
now opens closed prospects on their own tab.

## Residual

```json
[
  {"id": "R1-no-times-for-booked", "item": "Booked calls have a date but no time (next_call_date is a date).", "why_skipped": "The pipeline stores a date only; adding a time is a schema change of its own.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:45:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-cap-500", "item": "The week's held calls are read up to 500 (F2).", "why_skipped": "Far above any team's week today.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T00:45:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-no-calendar-sync", "item": "No Google/Outlook calendar connection; meetings booked outside ELOSTATE do not appear (ledger F4).", "why_skipped": "A separate integration build.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:45:00Z", "outcome": "Stays on the still-to-build list."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
