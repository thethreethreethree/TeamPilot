# BUILD - Revenue Phase 6: the forecast board

Migration 0376 (forecast_submissions, forecast_targets). No env keys.

### A rep submits a forecast
write-path: Pipeline → Forecast → board → Commit / Best case → POST /api/coach/remote/forecast {submit} → listProspects (the caller's own open deals closing in the quarter) → forecast_submissions row with those deals.
read-path: GET /forecast?period → latest per person and column → the board; earlier rows → last quarter's accuracy.

### A manager sets a target
write-path: the board → Target → POST {target} → forecast_targets (policy: manager, tree allows the person).
read-path: GET → latest target per person → the board and "% of target".
