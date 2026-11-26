# CLOSURE - Course due dates and retired scenarios

## What is true now

A manager can move a rep's course due date from the progress table (a new row each time; the rep sees it); a retired
scenario is no longer given to anyone new through a course. Both mirror 0282's rules for practice.

Un-named reliance: moving a course's due date does not move its practice assignments' due dates (they keep their own).

## Residual

```json
[
  {"id": "R1-practice-due-follow", "item": "Moving a course's due date leaves its practice scenarios' own due dates as they were.", "why_skipped": "A rep may have that scenario from elsewhere; moving it silently would change another assignment.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T05:15:03Z", "outcome": "Recorded."},
  {"id": "R2-undo-done", "item": "A lesson marked done still can't be unmarked.", "why_skipped": "Needs its own append-only undo rows.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T05:15:03Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
