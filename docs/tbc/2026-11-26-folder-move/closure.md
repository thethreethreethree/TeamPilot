# CLOSURE - Moving a library folder

## What is true now

Whoever may archive a folder can move it: to the top level or into another folder of the same library. A loop or a
fourth level is refused by the database with a plain sentence. Paths, archive-inside and save-by-path all follow
where a folder is now.

Un-named reliance: rss_folder_parent_now is called per folder in the view; with hundreds of folders it is fine, with
tens of thousands it would want an index-backed rewrite.

## Residual

```json
[
  {"id": "R1-view-cost", "item": "library_folders_current computes each folder's current parent with a function call per row.", "why_skipped": "Production has 0 folders; correct first, fast when it matters.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T09:24:01Z", "outcome": "Recorded."},
  {"id": "R2-move-between-libraries", "item": "A folder can't move between a personal library and the company library.", "why_skipped": "Moving to the company library would share calls; that's a consent question.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T09:24:01Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
