# REMEDIATE - Show one manager's team on Coaching

### F1 - a team parameter could reach outside the caller's tree
gate-or-promise: gate (teamScope test: not allowed → 404, nothing read)
### F2 - the team read ran on every request
gate-or-promise: gate (teamScope test: no team → the database isn't read)
### F3 - four copies of the URL helper
gate-or-promise: promise (one shared helper)
