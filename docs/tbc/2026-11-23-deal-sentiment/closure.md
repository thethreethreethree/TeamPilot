# CLOSURE - Deal sentiment

## What is true now

Each prospect in the Pipeline can show how the customer felt on its last call — warming, cooling or neutral — and
whether that was better, worse or the same as the call before, read from the call timelines the product already
makes. A customer who cooled on the last call counts as a deal-risk reason, so it feeds "At risk", the Forecast view
and the Ask box. Nothing shows for a prospect until one of its linked calls has a reading; in production no calls are
linked to prospects yet, so the lines appear as reps use "Add to pipeline" on their calls.

## Residual

```json
[
  {"id": "R1-no-links", "item": "0 calls linked to prospects in production; the feature is invisible until reps link calls (F1).", "why_skipped": "A workflow step, not code.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T09:33:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-no-sentiment-trend-history", "item": "Only the last two calls set the trend; no chart over the whole deal.", "why_skipped": "Simple first.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T09:33:00Z", "outcome": "Deferred."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
