# BUILD - Acting on the review of the training-course builds

No migration. No env keys.

### A manager moves a course's due date
write-path: PATCH /course-assignments → training_course_due_changes → movePracticeDue → training_due_changes rows for the rep's unfinished practice of this course (502 if that part fails).
read-path: GET /course-assignments → currentDue; the practice list → its own current due → the same date.

### A manager assigns (or re-assigns) a course
write-path: POST /course-assignments → new reps' course rows → assignPractice for new AND existing takers (existing: their current course date, their assigning manager) → the reply's counts.
read-path: the editor's result sentence from assigned / alreadyAssigned / skipped; a 502 reloads the table.

### A rep's course with a retired practice
write-path: none.
read-path: GET /course-assignments → retiredScenarios → a practice retired before the rep got it is listed with retired: true and left out of courseProgress → "doesn't count toward the course". GET /courses → scenarioRetired → the manager's note.
