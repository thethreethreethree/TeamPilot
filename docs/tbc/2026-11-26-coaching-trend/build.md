# BUILD - Coaching metrics against the 30 days before

No migration. No env keys.

### A manager checks whether coaching is up or down
write-path: none.
read-path: Remote Sales → Coaching → coaching metrics table → "5 ▲3" (title "2 in the 30 days before"); a manager who
coached before but not now shows "0 ▼3"; unchanged shows no arrow. GET /api/coach/remote/coaching-metrics → `previous`.
