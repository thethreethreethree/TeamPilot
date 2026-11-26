# BUILD - The team picker says when it couldn't check

No migration. No env keys.

### A manager picks a team while the tree check fails
write-path: none.
read-path: ?team=<manager> on KPI (me, team), coaching metrics, usage, coaching inbox, team stats, coverage → teamFromRequest → 503 "Couldn't check your team right now. Try again."
