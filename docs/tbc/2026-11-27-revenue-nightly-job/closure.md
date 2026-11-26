# CLOSURE - The nightly revenue job

## What is true now

Built and tested: each night, each company's open deals have their warnings recorded (once per deal per day), and
close-date agents run on deals whose expected close date is within their window, once per close date. Drivers show
Now, 30 days ago and 90 days ago; a day with no record says so. The job runs from /api/coach/remote/revenue-daily-cron
(05:15 UTC) and answers 503 until CRON_SECRET is set in Vercel.

## Residual

```json
[
  {"id": "R1-cron-secret", "item": "The job has not run end to end.", "why_skipped": "CRON_SECRET is unset in Vercel (§1.5.3); the route says so with a 503.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-26T23:11:00Z", "outcome": "Recorded in OPEN.md as the one setup step."}
]
```

## Un-named reliance

listProspects keeps pinning every read when given companyId; dealRisk stays the one verdict.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
