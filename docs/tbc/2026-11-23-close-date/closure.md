# CLOSURE - Expected close date and the forecast by month

## What is true now

A prospect card has an "Expected close" date beside "Next call"; it shows on the list row as "Close: …". Pipeline →
Forecast has "By expected close month": past-due deals in their own row, then each month with deals, value, and the
expected amount (value × the pipeline's own win rate, "—" until 5 deals have closed); deals with no date are counted
underneath. An open deal whose expected close date has passed gets "Expected close date passed" as a risk reason, and
the Ask box sees each deal's expected close. Migration 0320 is applied to production; production has no prospects yet,
so no real date has been set.

## Residual

```json
[
  {"id": "R1-quarters", "item": "The forecast groups by month only; no quarter view or what-if (move a deal's date and see the month change).", "why_skipped": "Months first; quarters are a sum of these rows.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T20:50:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
