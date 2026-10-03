# CLOSURE - the KPI job finishes

## What is true now

The KPI job makes one clear and one insert per agent instead of 24 round trips, so 12 agents fit easily inside its
60 s budget, and a failed clear can no longer be followed by a duplicating insert.

## Residual

```json
[
  {
    "id": "R1-scheduled-run-unseen",
    "item": "The fix has not run in production; the next scheduled run is 2026-10-04 05:00 UTC.",
    "why_skipped": "Triggering it by hand writes production data, which needs the founder's go-ahead; the schedule runs it anyway.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-10-03T05:35:00Z",
    "outcome": "OPEN. Check: compute-cron 200 at 2026-10-04 05:00Z, and kpi_snapshot 'current' = 72 rows for 12 agents."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
