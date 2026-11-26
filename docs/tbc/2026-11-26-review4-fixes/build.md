# BUILD - Acting on the fourth review

No migration. No env keys.

### A manager compares 90 days with the 90 before
write-path: none.
read-path: Coaching → "90 days" → GET /api/coach/remote/coaching-metrics?days=90 → calls read back 360 days, so both
periods see calls up to 180 days old.

### A period fails to load
write-path: none.
read-path: Coaching → "90 days" → 500 → "Couldn't load coaching for the last 90 days. Pick a period to try again." with the buttons still there.

### An admin picks a team KPI refuses
write-path: none.
read-path: KPI → Company → Team picker → GET /api/coach/kpi/me?scope=company&team=<id> → 404 → the error banner, no company cards.
