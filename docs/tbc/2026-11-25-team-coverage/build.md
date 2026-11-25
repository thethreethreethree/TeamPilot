# BUILD - What the team's calls cover

No migration. No env keys.

### A manager checks what the team's calls cover
write-path: none (reads only).
read-path: Remote Sales → Coaching → "What the team's calls cover" → GET /api/coach/remote/coverage?days=30 → for each
tracker "75% · 6 of 8" with a bar, and the top 10 topics; 7 / 30 / 90 days.

### The manager opens the calls behind a share
write-path: none.
read-path: a tracker row → /dashboard/remote-sales/search?tracker=<id>&from=<period start>; a topic row →
/dashboard/remote-sales/search?topic=<topic>&from=<period start>.

### No trackers yet
write-path: none.
read-path: "No trackers yet. Set one up" → /dashboard/remote-sales/trackers.
