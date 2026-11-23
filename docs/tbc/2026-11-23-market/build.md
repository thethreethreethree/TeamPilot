# BUILD - Market: competitors and topics across calls

No migration. No env keys.

### See the market across calls
write-path: none.
read-path: Remote Sales → Market (managers; MarketView) → GET /api/coach/remote/market?module=remote_sales&days= →
caller's client: sales calls of the module (isSalesCall), latest coach.session_intel_generated per call (100 calls per
request, paged) → computeMarket (market.ts) → summary (analyzed calls, closed, overall win rate), competitors (calls,
share, win rate when named vs overall, weekly bars), top topics.
