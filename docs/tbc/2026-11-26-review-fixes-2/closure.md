# CLOSURE - Fixes from the second 26 Nov review

## What is true now

The KPI team table keeps the chosen team, never shows another team's rows under its name, and says when a team can't
load. Coaching trends compare like with like. Library folders' archive state is read completely, archived folders
aren't offered for saving, a save that restores one says so, and empty folders can be archived.

## Residual

```json
[
  {"id": "R1-restore-before-insert", "item": "Saving to an archived folder records the restore before the item; if the item insert then fails, the folder stays restored.", "why_skipped": "Benign: the folder is just visible again.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-25T23:30:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
