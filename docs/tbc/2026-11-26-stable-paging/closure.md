# CLOSURE - Stable order for paged reads

## What is true now

Today's paged reads of hides and coverage events read every row exactly once.

## Residual

```json
[
  {"id": "R1-older-paging", "item": "Older paged reads ordered by non-unique keys (KPI started_at, schedule seq, my-points created_at, door log, finance) were not changed.", "why_skipped": "Outside this build; listed in OPEN.md for an invariant.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-26T00:00:00Z", "outcome": "Flagged."},
  {"id": "R2-deploy-window", "item": "Between applying 0347 and this deploy, service-role lists did not filter hidden calls (RLS still did).", "why_skipped": "Minutes; pushed at once.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T00:00:00Z", "outcome": "Accepted; recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
