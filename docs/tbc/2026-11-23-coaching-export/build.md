# BUILD - Coaching export

No migration. No env keys.

### Download coaching numbers
write-path: Remote Sales → Coaching → "Download CSV" → GET /api/coach/remote/coaching-metrics?format=csv (managers;
D8-gated; tree-filtered; same computation as the panel) → audit_log session.export { kind: coaching_metrics, rows }.
read-path: coaching-YYYY-MM-DD.csv: person, feedback_given, calls_listened, period_start, period_end (alphabetical;
formula-safe).
