# REMEDIATE

### The pitch scorer re-derived the session-length rule without its cap

gate-or-promise: gate

INVARIANT 31 plus the route test; both fail on the old copy (mutations caught).

### An auto-closed session's ended_at is not when the conversation ended

gate-or-promise: promise

Every duration reader now goes through conversationDurationSeconds, which treats a span over 4 hours as
unknown. Stamping the cron's ended_at with the last activity instead is a schema change, recorded as a residual.
