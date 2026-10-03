# CLOSURE - a transcript has versions

## What is true now (in the repo; nothing is applied or deployed yet)

A repair or relabel appends a version and keeps the old one; every reader, web and app, reads the newest.

## Residual

```json
[
  {
    "id": "R1-migration-not-applied",
    "item": "0269 is not applied to production; the website commit must not deploy before it.",
    "why_skipped": "A production migration needs the founder's go-ahead.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-03T07:30:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R2-app-embed-unproven",
    "item": "The app's embedded count through the view (PostgREST relationship inference on a view) is unproven until 0269 is live.",
    "why_skipped": "Needs the view in production; a read-only request will confirm it before app build 30.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-03T07:30:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R3-stuck-calls-not-repaired",
    "item": "The 12 stuck calls are not repaired yet; their recovery budget is spent.",
    "why_skipped": "Needs 0269 live, then a deliberate re-run.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-03T07:30:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
