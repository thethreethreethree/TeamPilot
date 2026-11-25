# CLOSURE - Every paged read ordered by a unique key

## What is true now

Every paged read in the app orders by a unique key last, and the invariant audit refuses a new one that doesn't.

## Residual

```json
[
  {"id": "R1-regex-scan", "item": "Invariant 42 reads statements by text (from .from()/.rpc() to .range()); a paged read built across helper functions could slip past it.", "why_skipped": "The same text-scan shape as the other invariants.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T23:15:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
