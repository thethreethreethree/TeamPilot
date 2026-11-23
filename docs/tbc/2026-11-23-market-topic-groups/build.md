# BUILD - Group similar topics on Market

No migration. No env keys. No stored data changes: grouping happens when Market is read.

### See what customers raise, one row per topic
write-path: none.
read-path: Remote Sales → Market (and Sales Coach → Analytics) → MarketView → GET /api/coach/remote/market →
computeMarket (market.ts) → topics grouped by topicKey (word order, small words, word endings) → each topic named by
its most used wording, with the other wordings (`variants`) shown as "+N wordings" and on hover.
