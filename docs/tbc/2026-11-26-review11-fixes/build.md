# BUILD - Acting on the review of the folder, filler and tracker builds

Migration 0363 (rss_folder_library_lock; both folder guards take it; the move walk capped at 10; no same-named siblings
on a move). No env keys.

### A manager moves a branch
write-path: the 'Folders with no calls of their own' list → Move → POST /library {action:"move"} → library_folder_events → the guards (locked per library; loop, depth, name).
read-path: GET /library → library_folders_current → the branch under its new parent.

### A manager reads coverage
write-path: none.
read-path: GET /api/coach/remote/coverage → calls with started_at and context → trackers with dates and call types → coverageShare: each tracker's share over the calls it listens to ("n of N").
