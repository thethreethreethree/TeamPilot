# BUILD - Practice steps in training courses

Migration 0357 (training_course_steps: scenario_id; kind lesson|practice with a shape check). No env keys.

### A manager adds a practice step and assigns the course
write-path: PUT/POST /api/coach/remote/courses steps[{kind:"practice", scenarioId}] → scenariosUsable → new step version → (PUT) existing takers get the scenario (training_assignments, assigned_by their course's manager). POST /course-assignments → course assignments → assignPractice for the new reps, due with the course.
read-path: GET /courses → steps with kind and scenarioId → the editor shows Lesson / Practice and the scenario.

### A rep practises a course step
write-path: the role-play records a training_attempts row as before (0282); PUT /course-assignments refuses a practice step (400).
read-path: GET /course-assignments → practiceStates (assignments, due changes, attempts → assignmentStatus) → the step's state, its practice link, and the course's done count.
