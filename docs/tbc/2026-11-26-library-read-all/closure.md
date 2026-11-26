# CLOSURE - The library reads every item

## What is true now

The library shows the newest 300 saved calls and clips that remain after removals, says when there are more, and
refuses to answer if removals can't be read.

Un-named reliance: lookups for the shown items (sessions, snippets, names) are single reads of ≤300 ids.

## Residual

```json
[
  {"id": "R1-older", "item": "Items past the newest 300 can't be paged to in the Library itself.", "why_skipped": "No library holds that many yet; Search finds them.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T01:33:00Z", "outcome": "Accepted."},
  {"id": "R2-gate", "item": "No audit refuses a .limit(n) applied before a filter that drops rows.", "why_skipped": "The pattern needs data-flow reading a regex audit can't do reliably.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T01:33:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
