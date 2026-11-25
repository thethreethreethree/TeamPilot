# BUILD - Follow a saved search and see its new calls

Migration 0342_saved_search_follows.sql (applied; DB at 0342). No env keys.

### A rep follows a saved search
write-path: Remote Sales → Search → saved search → bell → POST /api/coach/remote/saved-searches/events {kind: "follow"}
→ saved_search_events.
read-path: the bell turns solid ("Stop following …"); later visits to Search show "3 new" beside it.

### The rep opens it
write-path: click the name → POST /api/coach/remote/saved-searches/events {kind: "seen"}.
read-path: the search runs with its filters; the badge clears; GET /api/coach/remote/saved-searches counts from now.

### The rep stops following
write-path: bell → {kind: "unfollow"}.
read-path: no badge; no search is run for it on load.
