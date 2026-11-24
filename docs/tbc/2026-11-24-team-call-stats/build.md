# BUILD - Team call stats

No migration. No env keys.

### A manager reads the team's call stats
write-path: none (reads session_interaction_stats + coaching_sessions + profiles).
read-path: Remote Sales → Coaching → Team call stats → 7 / 30 / 90 days → Team row and one row per rep: calls, talk ratio,
longest monologue, longest customer story, patience, questions per hour, interactivity (GET /api/coach/remote/team-stats).
