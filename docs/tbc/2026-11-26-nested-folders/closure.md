# CLOSURE - Nested library folders

## What is true now

A library folder can sit inside another, up to three levels, named as a path in the same save box. Archiving a folder
hides what's inside it; restoring brings it back; saving into a hidden folder brings its path back.

Un-named reliance: a "/" in a folder name now always means "inside" — production had no such names.

## Residual

```json
[
  {"id": "R1-move", "item": "A folder can't be moved under another after it's created.", "why_skipped": "Folders are never updated (0280); a move would need a new folder and re-adding its calls.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T01:10:00Z", "outcome": "Accepted."},
  {"id": "R2-slash", "item": "A folder name can no longer contain '/'.", "why_skipped": "'/' is the path separator; 0 existing names used it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T01:10:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
