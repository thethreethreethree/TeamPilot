# BUILD - Team-wide list of uncoached calls with an interaction alert

No migration. No env keys.

### A manager finds the unusual calls across the team
write-path: none.
read-path: GET /api/coach/remote/coaching-metrics (unchanged) → byRep[].uncoached + alerts.byCall → "N uncoached calls with an interaction alert" → the list, newest first, each a link to the call.
