# BUILD - Show one manager's team on Coaching

No migration. No env keys.

### A manager picks a team
write-path: none (the choice is kept in the page URL, ?team=<manager id>).
read-path: Remote Sales → Coaching → "Showing [Theo's team (2)]" → the inbox, coaching metrics, team usage, team call
stats and coverage reload with &team=<id>; each lists only that manager and the people below them.

### Back to everyone
write-path: none.
read-path: "Everyone you can see" → the five panels reload without the parameter, as before.

### A team the manager can't see
write-path: none.
read-path: a hand-made ?team=<id> outside the caller's tree → the routes answer 404 "Team not found."; nothing about
that manager is read.
