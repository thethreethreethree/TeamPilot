# CLOSURE - E16

## What is true now

A read key can list the to-dos on deals, the company library's folders and calls, and the company's flows and
enrolments; personal folders and coaching comments stay out of the API.

## Residual

```json
[
  {"id": "R1-coaching-comments", "item": "Coaching comments (F31.3's coaching part) aren't in the API.", "why_skipped": "Each comment has its own visibility (everyone / named / only me); a company-wide key can't honour it. Recorded in the plan row as not built.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-28T04:41:00Z", "outcome": "Recorded."},
  {"id": "R2-enrolment-state", "item": "Enrolments are listed without their current step or outcome (that's replayed from engage_activities).", "why_skipped": "The replay lives in the app (flows.ts); an API field can follow if an integration needs it.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-28T04:41:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
