# BUILD - Time on calls per person

No migration. No env keys.

### A manager reads the team's time on calls
write-path: none (reads the record: coaching_sessions started_at, ended_at, audio_duration_seconds).
read-path: Remote Sales → Coaching → Team usage → 7 / 30 days → per person "Time on calls" (e.g. 2h 05m, * when some
calls had no known length) and "Avg call" (m:ss), from /api/coach/remote/usage (conversationDurationSeconds per call).
