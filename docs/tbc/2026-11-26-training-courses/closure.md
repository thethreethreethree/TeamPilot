# CLOSURE - Training courses (ordered lessons)

## What is true now

Managers write courses as ordered lessons, edit them (a new version each time; reps keep what they've done), assign
them with a due date, retire them, and see each rep's progress. Reps see "Your courses", read the lessons in order and
mark each done; the next lesson opens. All four tables carry the MFA rule, and a new audit rule stops the next table
that doesn't.

Un-named reliance: the static MFA rule reads table names from migration text; a table created by dynamic SQL is not seen.

## Residual

```json
[
  {"id": "R1-practice-steps", "item": "A course holds lessons only; practice steps (linking a scenario) are the next build.", "why_skipped": "Staged build.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-26T04:21:44Z", "outcome": "Next build."},
  {"id": "R2-content-blocks", "item": "Lessons are text only; a library call or an external video in a lesson is F17.2.", "why_skipped": "Staged build.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-26T04:21:44Z", "outcome": "Recorded."},
  {"id": "R3-due-change-undo", "item": "A course's due date can't be moved yet, and a lesson marked done can't be unmarked.", "why_skipped": "Both need their own append-only rows (as training_due_changes).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T04:21:44Z", "outcome": "Recorded."},
  {"id": "R4-bell", "item": "Assigning a course sends no bell notice.", "why_skipped": "The notice kinds are a database check list; adding one is its own migration.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T04:21:44Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
