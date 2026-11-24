# BUILD - KPI period: 30 / 90 days / all time for the outcome numbers

No migration. No env keys.

### Someone switches the KPI period
write-path: none (reads sessions).
read-path: Sales Coach → KPIs → All time / 90 days / 30 days → GET /api/coach/kpi/me?days= → conversion, close rate,
win/loss, revenue, average deal, sessions per day and session length (and their trend deltas) over that period, each
card noting "last N days"; quota notes "this month"; the rest note "all time".
