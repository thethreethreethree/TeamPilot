# CHECK - Acting on the review of the training-course builds

## Commands

```
npx vitest run course-assignments Courses.render coursePractice dueDay courses library → passed (24, then 15 with the new review cases)
npx vitest run noFailedReadAsEmpty americanSpelling → 7 passed; theme:audit → clean
node scripts/invariant-audit.mjs → 0
npx tsc --noEmit → clean; eslint on the changed files → clean
npm run check → gates the commit
```

## Findings

### F1 - a retired practice made a course impossible to finish
class: two rules (retire; course progress) that never met.
sweep: course progress and the manager's course list.
severity: medium

### F2 - practice due dates drifted from the course
class: a re-derived due date (original instead of current).
sweep: course PUT, course POST retry, PATCH.
severity: medium

### F3 - "You finished" after a failed refresh
class: error-as-success.
sweep: AssignedCourses.
severity: medium

### F4 - "Assigned." whatever happened; the manager in their own picker
class: a reply's counts ignored.
sweep: CourseManager.
severity: low

### F5 - due days in the server's zone
class: a zoneless time parsed on the server.
sweep: CourseManager and TrainingManager (the same pattern).
severity: low

### F6 - two unbounded .in() lists in one request
class: request size.
sweep: coursePractice.
severity: low
