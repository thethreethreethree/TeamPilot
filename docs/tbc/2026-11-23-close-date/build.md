# BUILD - Expected close date and the forecast by month

Migration 0320 (applied to production). No env keys.

### Set the expected close date
write-path: Pipeline → prospect card → "Expected close" date → POST /api/coach/remote/prospects/:pid { action: "set",
kind: "close_date", value } → eventValue → insert remote_prospect_events (caller's client; RLS as for every fact).
read-path: remote_prospects_current.close_date → listProspects closeDate → list row "Close: …", card field.

### Read the forecast by month
write-path: none.
read-path: Pipeline → Forecast → ByCloseMonth → forecastByMonth (dealRisk.ts) → past due · each month · undated; and
dealRisk's "Expected close date passed" in Deals at risk; Ask box line "expected close: …".
