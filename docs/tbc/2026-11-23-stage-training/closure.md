# CLOSURE - Training by deal stage

## What is true now

A manager can mark a practice scenario as being for one or more pipeline stages (Training → Scenarios → "+ Stage",
choosing from the stage names reps already use). When a rep opens one of their open prospects at that stage, the
prospect shows "Practice for “<stage>”" with those scenarios; one click starts the practice as the rep's own, due on the
prospect's next call, and opens the role-play. Starting it again continues the same practice. Managers see it in their
Assigned practice table marked "(self-started)"; the rep sees "you started this". Nothing appears unless a manager
tagged a scenario, and only the prospect's own rep can start it. The database change is applied.

## Residual

```json
[
  {"id": "R1-free-text-stages", "item": "Stage names are free text; a tag matches only the same name (ignoring case and spacing).", "why_skipped": "A fixed company stage list is a pipeline change of its own.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:55:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-null-reads", "item": "11 other client reads turn a failed fetch into null (F1).", "why_skipped": "Each must be read to tell a label read from a data read.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:55:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R3-rep-needs", "item": "Gong's line says 'pipeline stage AND rep needs'; this build covers stage only (the rep's weak skills are not yet used to pick among the stage's scenarios).", "why_skipped": "Stage first; ranking by a rep's weakest rubric items is its own build.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:55:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R4-ui-test", "item": "No component test renders the stage chips or the prospect's practice list.", "why_skipped": "No component harness for these screens yet.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T00:55:00Z", "outcome": "Covered by the existing OPEN.md component-test entry."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
