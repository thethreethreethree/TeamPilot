# CLOSURE - Nightly job review fixes

## What is true now

The nightly job keeps within its time, and two later slots continue anything left; each company is dated by its own
timezone and runs in its own try; a close-date agent claims its fire before acting, so it never acts twice, and a
temporary read failure doesn't use the fire up; failures and leftovers are reported as a 500 with counts.

## Residual

```json
[
  {"id": "R1-first-run", "item": "The first real run is at 05:15 UTC 2026-11-28.", "why_skipped": "Scheduled.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T23:22:00Z", "outcome": "OPEN.md: check the three slots' responses and that day's snapshots."},
  {"id": "R2-at-most-once", "item": "A run killed between claiming and acting misses that action (it is not retried).", "why_skipped": "Chosen over a doubled action.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T23:22:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

companies.timezone stays an IANA name or empty (0226's admin guard).

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
