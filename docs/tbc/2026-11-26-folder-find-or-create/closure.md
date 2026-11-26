# CLOSURE - Folder path levels found or made in one statement

## What is true now

Saving into a folder path finds or makes each level in one database statement under the library's lock, so the same
new folder is never made twice.

Un-named reliance: the lock is per library and per transaction (each level is its own short transaction).

## Residual

```json
[
  {"id": "R1-existing-duplicates", "item": "Any duplicate folders made before 0365 stay as they are.", "why_skipped": "Production has 0 folders; nothing to merge.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T10:25:34Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
