# BUILD - Course due dates and retired scenarios

Migration 0358 (training_course_due_changes, with mfa_required). No env keys.

### A manager moves a rep's course due date
write-path: PATCH /api/coach/remote/course-assignments {assignmentId, dueAt} → manager → treeAllowsRepChecked (null → 503, false → 404) → training_course_due_changes row.
read-path: GET /course-assignments → due changes per assignment → currentDue → dueAt and courseProgress state → the rep's "due …" and the manager's date field.

### A course with a retired scenario is assigned
write-path: assignPractice → training_scenarios retired_at → only live scenarios become training_assignments.
read-path: the rep's existing practice of a retired scenario still reads through practiceStates as before.
