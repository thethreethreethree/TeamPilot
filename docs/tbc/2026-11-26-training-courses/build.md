# BUILD - Training courses (ordered lessons)

Migrations: 0355 (training_courses, training_course_steps, training_course_assignments, training_step_completions),
0356 (mfa_required on those four). No env keys.

### A manager writes a course and gives it to reps
write-path: POST /api/coach/remote/courses {title, summary, steps} → training_courses + training_course_steps version 1 → the Assign panel opens → POST /api/coach/remote/course-assignments {courseId, repIds, dueAt} → treeFilterRepsChecked → training_course_assignments (reps without it).
edit: PUT /courses {courseId, steps} → version N+1 (409 if two saves race). retire: PATCH → retired_at.
read-path: GET /api/coach/remote/courses → the company's courses → each one's highest version (currentSteps) → the course list, lesson count, Edit and Assign.

### A rep reads the lessons
read-path: GET /api/coach/remote/course-assignments → own assignments → current steps → completions → courseProgress.
write-path: PUT {assignmentId, stepUid} → the rep's own assignment, a lesson in the current version → training_step_completions → the next unfinished lesson opens.

### A manager checks progress
write-path: none (progress comes from the reps' training_step_completions rows).
read-path: GET /course-assignments?team=1 → tree (null → 503) → progress per rep, no lesson text.
