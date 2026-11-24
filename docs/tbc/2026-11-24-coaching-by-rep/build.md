# BUILD - Coaching by rep

No migration. No env keys.

### A manager decides whom to coach next
write-path: none (reads coaching_sessions, coaching events, feedback_requests, profiles).
read-path: Remote Sales → Coaching → "Your reps, last 30 days": per rep last feedback (Overdue in amber), feedback
count, open requests, calls · not yet coached — from /api/coach/remote/coaching-metrics `byRep` (coachingByRep).
