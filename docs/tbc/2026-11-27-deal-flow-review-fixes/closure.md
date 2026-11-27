# CLOSURE - deal-flow review fixes

## What is true now

A deal's history shows account moves by name; meeting prep isn't lost to a late booking or a missed night; the forecast
reminder arrives before the due day and names it; the bell opens the board from anywhere.

## Residual

```json
[
  {"id": "R1-rep-timezone", "item": "'Tomorrow' and 'today' are the company's days; a rep in another timezone may get prep a day early or the morning of.", "why_skipped": "next_call_date carries no timezone; the company day is the one clock the job has.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-27T12:02:00Z", "outcome": "Recorded."},
  {"id": "R2-window-utc", "item": "The reminder's 7-day window starts at UTC midnight six days before the due date, not the company's midnight.", "why_skipped": "A few hours at one edge of a week; the board shows who has submitted.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T12:02:00Z", "outcome": "Recorded."},
  {"id": "R3-column-before-migration", "item": "The nightly companies read names forecast_due_weekday, so code deployed before 0391 would stop the whole run (lookupFailed).", "why_skipped": "0391 is applied on production (db:apply, verify:live passed); fails loud, not silent.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T12:02:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
