# CLOSURE - Forecast deals and movement; win/loss drill-down and CSV

## What is true now

Opening a forecast number shows when it was submitted, the open deals behind it, how it moved since the one before
(amount, deals in and out) and progress to target; anyone who can see the number can open it, only its owner changes it.
Each win/loss row opens its closed deals, and the breakdowns download as CSV.

## Residual

```json
[
  {"id": "R1-forecast-due-day", "item": "Forecast due day and reminder (F22.4).", "why_skipped": "Decision R12 places it at Phase 8 onward; a reminder also needs CRON_SECRET (OPEN.md).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T22:52:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

Submissions keep storing their deals at submit time (0376); toCsv stays the one CSV writer.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
