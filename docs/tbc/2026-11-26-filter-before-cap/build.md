# BUILD - Filter before the cap

No migration. No env keys.

### A manager opens the coaching inbox in a busy company
write-path: none.
read-path: GET /api/coach/remote/coaching-inbox → every request in 90 days (paged) → tree, team, hides → the newest 300 → { items, truncated }.

### A manager opens team assignments
write-path: none.
read-path: GET /api/coach/remote/assignments?team=1 → every assignment (paged) → tree → the newest 500 → { assignments, truncated }.
