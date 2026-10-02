# CLOSURE - someone is told when it breaks

## What is true now

Whether production reports errors can be read with one curl, and an AI outage is reported once per outage. Nothing
is reported yet: production has no DSN until the founder creates one.

## Residual

```json
[
  {
    "id": "R1-dsn-not-set",
    "item": "Production has no NEXT_PUBLIC_SENTRY_DSN; until it does, /api/health says errorReporting false and nothing reaches Sentry.",
    "why_skipped": "Creating the Sentry project is the founder's step (outside the repo).",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-02T06:20:00Z",
    "outcome": "OPEN. Steps in docs/CONFIG-PRECONDITIONS-AUDIT.md, 2026-10-02 section."
  },
  {
    "id": "R2-delivery-unseen",
    "item": "No event has been seen arriving in Sentry.",
    "why_skipped": "Needs the DSN and then a real error or outage.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-02T06:20:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
