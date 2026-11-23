# REMEDIATE - Alert the founders to waiting security reports

### F1 - the badge updates on navigation, not the moment a status is recorded
Accepted: the founder records a status on the inbox page and the count re-reads as soon as they move on.
gate-or-promise: promise (closure residual)

### F2 - the first version capped the event read at a limit PostgREST silently lowers to 1000
Both reads page every row (fetchAllPagedResult, ordered by id).
gate-or-promise: gate (invariant-audit false-bound rule)
