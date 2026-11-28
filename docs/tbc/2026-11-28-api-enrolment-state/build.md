# BUILD - Enrolment state in the API

### Enrolment state
write-path: none.
read-path: GET /api/v1/flows reads the page's enrolments' activities and flows' steps (company-pinned) and returns state, step and dueAt from replayEnrolment.
