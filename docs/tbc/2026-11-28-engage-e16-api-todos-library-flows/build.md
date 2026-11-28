# BUILD - E16: to-dos, library, flows in the API

### To-dos
write-path: none (reads; the request is recorded in api_usage).
read-path: GET /api/v1/todos — the to-dos on deals (remote_prospect_tasks → tasks), deleted ones left out, `more`.

### Library
write-path: none.
read-path: GET /api/v1/library — company folders (not archived) with their items (not removed, no note), items on calls with an active hide left out.

### Flows
write-path: none.
read-path: GET /api/v1/flows — company flows (not retired) and enrolments, paged, `more`.
