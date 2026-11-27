# CLOSURE - forecast due day

## What is true now

The forecast board says when forecasts are due (admins change the day); on that day, everyone who forecasts and hasn't
submitted this week gets one reminder in the bell that opens the board.

## Residual

```json
[
  {"id": "R1-first-forecast", "item": "Someone who has never submitted a forecast (this quarter or last) isn't reminded — there's no other record of who is meant to forecast.", "why_skipped": "A list of who must forecast would be a new setting nobody asked for; the board's team row already shows who hasn't submitted.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-27T11:54:00Z", "outcome": "Recorded."},
  {"id": "R2-no-deals", "item": "A company with no deals is re-read by each of the night's three cron slots for reminders (the claims stop a second send).", "why_skipped": "Three cheap reads a night; the claim is the guard.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T11:54:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
