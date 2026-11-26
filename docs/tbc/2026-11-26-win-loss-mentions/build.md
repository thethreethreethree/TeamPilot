# BUILD - Win and loss by what was said

No migration. No env keys.

### Someone reads whether a competitor coming up changes the odds
write-path: none.
read-path: Pipeline → Sources → win/loss → GET /api/coach/remote/prospects/mentions?repId= (caller's client: closed prospects → remote_prospect_calls → tracker_hits → keyword_trackers) → "By what was said": per tracker, won–lost and rate when mentioned vs not.
