# BUILD - Shared saved searches (company streams)

Migration 0362 (saved_search_shares, with mfa_required). No env keys.

### A manager shares a saved search
write-path: POST /api/coach/remote/saved-searches/events {id, kind:"share"} → own search, manager → saved_search_shares row.
read-path: GET /saved-searches → shares → sharedNow → own searches marked shared; the share icon pressed.

### A teammate follows it
write-path: POST /saved-searches/events {id, kind:"follow"} → not theirs → sharedNow must hold → saved_search_events under THEIR id.
read-path: GET /saved-searches → shared searches of others (not removed) with "shared by" → follow state → newMatches through THEIR client → their count and the bell.
