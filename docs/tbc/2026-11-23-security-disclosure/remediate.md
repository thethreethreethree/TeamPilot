# REMEDIATE - Vulnerability disclosure

### F1 - no alert reaches the founders when a report arrives
The inbox is in the founders' sidebar and shows the count of new reports; no email or push yet.
gate-or-promise: promise (OPEN.md "security reports have no alert")

### F2 - the gates needed reasons for a public, untenanted write path
Each allowlist entry states its guard; a new statement in either route fails the invariant again.
gate-or-promise: gate (invariant-audit PUBLIC_ROUTE_ALLOWLIST / SERVICE_ROLE_TENANT_ALLOWLIST; rls-audit ALLOWLIST)
