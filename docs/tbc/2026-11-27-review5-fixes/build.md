# BUILD - Review 5 fixes

### Six-hour cap
write-path: none (refuses chunks past MAX_CALL_CHUNK before storage).
read-path: the recorder's own running state; chunk number.

### Audit API
write-path: api_usage.
read-path: audit_log (company, ?before or ?page) minus rows about hidden calls, details without AUDIT_META_WITHHELD keys.

### Topic sections
write-path: events (lines = covered lines).
read-path: unchanged; shown on sales calls only.
