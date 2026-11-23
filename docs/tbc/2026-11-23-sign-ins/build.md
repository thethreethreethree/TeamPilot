# BUILD - Count every sign-in in team usage

Migration 0327 (rss_sign_in_times) — applied to production. No env keys.

### See a team's sign-ins
write-path: none.
read-path: Remote Sales → Coaching → Team usage → GET /api/coach/remote/usage → rss_sign_in_times(company, people in the
tree, 30 days) → session + web-form records → mergeSignIns → sign-ins per person, last 7 / 30 days.
