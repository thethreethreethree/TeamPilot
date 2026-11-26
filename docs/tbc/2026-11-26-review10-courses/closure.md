# CLOSURE - Acting on the review of the training-course builds

## What is true now

A retired practice no longer traps a rep: it's shown as retired and left out of their count, and the manager's course
list says so. A course's practice follows its due date. A rep is never told they finished when the refresh failed. An
assign says what it did. Due dates mean the end of the picked day where the manager is.

Un-named reliance: a rep's practice that is NOT done and that they also had from elsewhere moves with the course date.

## Residual

```json
[
  {"id": "R1-any-manager-edits", "item": "Any manager can edit or retire any company course; a new practice step then reaches reps outside the editor's tree (assigned by their own manager).", "why_skipped": "Same rule as scenarios (company content); a per-course owner would be a new product rule.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T05:53:17Z", "outcome": "Recorded."},
  {"id": "R2-team-picker-scope", "item": "The Assign picker lists the whole company (from /api/team); reps outside the tree are refused and counted in the result.", "why_skipped": "A tree-scoped roster route is its own change; the result sentence now says what happened.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T05:53:17Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
