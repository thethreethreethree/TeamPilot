# BUILD - Deal sentiment

No migration. No env keys.

### See how the customer feels across a deal
write-path: none (computed from stored call timelines).
read-path: Pipeline → GET /api/coach/remote/prospects → listProspects(db, repId, { sentiment: true }) →
readDealSentiment (dealSentiment.ts): remote_prospect_calls → coach.session_moments_generated events (latest per call,
100 calls per request) → extractSessionSignals → dealSentimentFrom → each row: "Customer on the last call: warming /
cooling / neutral — better / worse / same as the call before"; a cooling last call is a deal-risk reason ("Customer
cooled on the last call"); the Ask box context carries it.
