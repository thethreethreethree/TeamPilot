# BUILD - The bell tells you when a followed search has new calls

No migration. No env keys.

### Someone follows a search and new calls arrive
write-path: none until opened; then POST /api/coach/remote/saved-searches/events {id, kind: "seen"}.
read-path: bell (every 10 min) → GET /api/coach/remote/saved-searches → "Searches you follow · 3 new calls match “Pricing
objections”" → /dashboard/remote-sales/search?q=price&saved=<id> → the search runs, and its new calls are marked seen.
