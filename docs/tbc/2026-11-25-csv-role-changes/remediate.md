# REMEDIATE - Team CSV changes roles too

### F1 - a bulk demotion could leave the company with no admin
setMemberRole re-counts admins for every row.
gate-or-promise: gate (setMemberRole.test.ts)
