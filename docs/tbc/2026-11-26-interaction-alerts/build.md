# BUILD - Interaction alerts on calls not yet coached

No migration. No env keys.

### A manager looks for which uncoached call to review
write-path: none.
read-path: GET /api/coach/remote/coaching-metrics → the calls already in scope (tree, team, hides) → session_interaction_stats for them (paged by id, newest version per call) → baselineFrom (team percentiles, ≥20 calls) → alertsFor each uncoached call → { alerts: { baselineCalls, needed, byCall } | null }.
screen: Coaching → by rep → "not yet coached" count → the list shows alert chips and "Only calls with an interaction alert (n)"; fewer than 20 calls → "starts once this team has N more analyzed calls"; failed read → "Couldn't load interaction alerts."
