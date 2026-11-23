# CLOSURE - Deal risk and forecast

## What is true now

Each open deal in the Pipeline list says why it may slip, in words: no next call booked, its booked call date passed
with no call, no call in 21 days, an overdue to-do — "At risk" with two of these, "Watch" with one — and notes a missing
amount. A new Forecast view shows the open pipeline, the value expected from it at this pipeline's own win rate (only
once 5 deals have closed; before that it says "Not yet" and how many have closed), what the pipeline is worth if the
at-risk deals are lost, and those deals, largest first, each opening the prospect. It follows "Whose pipeline", so a
manager sees a report's or the team's.

## Residual

```json
[
  {"id": "R1-thresholds", "item": "21/14 days, two reasons and five closed deals are chosen, not measured (F1).", "why_skipped": "No closed-deal history to measure against yet.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T08:30:00Z", "outcome": "Opened: OPEN.md — measure flagged-vs-lost once deals close (§4)."},
  {"id": "R2-ask-box", "item": "The Ask box does not see risk reasons (F2).", "why_skipped": "Next small change.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T08:30:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-no-close-dates", "item": "No expected close date per deal, so the forecast is not by month or quarter.", "why_skipped": "The pipeline has no close-date field.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T08:30:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
