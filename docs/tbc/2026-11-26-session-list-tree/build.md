# BUILD - The session list follows the reporting tree

No migration. No env keys.

### A manager opens the session history
write-path: none.
read-path: GET /api/coach/sales-session/list → pages of 500 (newest first) → hidden calls and reps outside the tree left out → the newest 300 → { sessions, truncated }.

### A manager opens calibration / team usage
write-path: none.
read-path: calibration pool paged newest first, then tree and hides (a failed read is a 500); usage reads every person, then the tree.
