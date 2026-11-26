# CLOSURE - One wait budget for every render test

## What is true now

Render tests wait up to 5 s for what they look for, so a busy machine no longer fails them; a render that never comes
still fails within the 20 s test timeout.

Un-named reliance: a test that expects something NOT to appear and uses waitFor to prove it would now wait longer.

## Residual

```json
[
  {"id": "R1-slower-negatives", "item": "A failing findBy now takes up to 5 s instead of 1 s to report.", "why_skipped": "The cost of a reliable gate.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T01:30:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
