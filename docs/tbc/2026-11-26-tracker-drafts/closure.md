# CLOSURE - Draft trackers

## What is true now

A manager can save a tracker as a draft — it is never matched against calls, never counted and never read by AI —
preview it, copy it to adjust, and put it live when it's right.

Un-named reliance: keyword_trackers_live is `select *`; a column added to keyword_trackers later needs the view recreated
to appear in it.

## Residual

```json
[
  {"id": "R1-draft-edit", "item": "A draft can't be edited in place, only copied into a new draft.", "why_skipped": "0276's rule that a tracker's words never change applies to drafts too; relaxing it for drafts is a design change.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T00:59:00Z", "outcome": "Accepted."},
  {"id": "R2-view-columns", "item": "keyword_trackers_live won't show a column added to keyword_trackers later until the view is recreated.", "why_skipped": "Postgres fixes a view's columns at creation.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T00:59:00Z", "outcome": "Accepted; noted in 0352."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
