# CLOSURE - CRON_SECRET is set

## What is true now

CRON_SECRET is set in production; the nightly revenue job's first scheduled run is 05:15 UTC 2026-11-28. The deal brief
has a render test.

## Residual

```json
[
  {"id": "R1-first-run", "item": "The nightly job's first real run hasn't happened yet.", "why_skipped": "It is scheduled for 05:15 UTC 2026-11-28.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T23:18:00Z", "outcome": "Recorded in OPEN.md: check the run and that day's snapshots."}
]
```

## Un-named reliance

The cron route keeps answering 503 when the secret is unset and 401 when it doesn't match.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
