# BUILD - Acting on the review of the library and win/loss builds

No migration. No env keys.

### A manager reads win/loss by what was said
write-path: none.
read-path: GET /api/coach/remote/prospects/mentions → closed deals → their calls → each call's newest session_interaction_stats version → tracker_hits on that version only → { mentions, withCalls } → byMention compares withCalls deals only.

### Someone asks the coach about their pipeline
write-path: none (the AI call as before).
read-path: listProspects (no sentiment) → 60 most recent → readDealSentiment for those 60.

### A manager reads folder usage
write-path: none.
read-path: GET /api/coach/remote/library → listen_events from each call's first save onward, the rep excluded.
