# CLOSURE - An audit check: service-role call reads must check hides

## What is true now

A new API route that reads calls with the service role fails the audit unless it checks hidden calls or is listed with
why it can't reach one.

## Residual

```json
[
  {"id": "R1-lib-level", "item": "The check reads route files; a lib function called from a route that reads calls with the service role is judged only through its route.", "why_skipped": "The same file-level shape as the other invariants.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T23:42:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
