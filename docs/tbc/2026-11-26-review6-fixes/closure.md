# CLOSURE - Acting on the review of nested folders

## What is true now

Saving into a folder by name or by id brings back any archived folder above it; a folder inside an archived one says
to restore its parent first.

Un-named reliance: the ancestor walk stops at three levels, matching the database's depth cap.

## Residual

```json
[
  {"id": "R1-dup-race", "item": "Two saves creating the same new folder path at the same moment can create a duplicate folder at a level.", "why_skipped": "No unique key on (company, library, parent, name); the same race existed for top-level folders before nesting.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T01:15:00Z", "outcome": "Accepted; later saves use the oldest."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
