# BUILD - A period for coaching metrics

No migration. No env keys.

### A manager compares coaching over a chosen period
write-path: none.
read-path: Remote Sales → Coaching → "Coaching in the last 30 days" → "7 days" → GET /api/coach/remote/coaching-metrics?days=7
(&team=<manager> when a team is picked) → the heading reads "last 7 days"; each column shows ▲/▼ against the 7 days before,
including Calls listened to and Typical response (only when both weeks have answers).

### A manager downloads what is on screen
write-path: none (the export's audit row, as before).
read-path: "Download CSV" → /api/coach/remote/coaching-metrics?format=csv&days=7&team=<manager>.
