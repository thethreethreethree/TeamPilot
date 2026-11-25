# REMEDIATE - Fixes from the second 26 Nov review

### F1 - the KPI team table reset or showed stale rows
gate-or-promise: promise (no KPI page render test for this path; the page is large and mock-heavy)
### F2 - the coaching trend compared different call ages
gate-or-promise: promise (constant and comment)
### F3 - archive state from a capped read
gate-or-promise: gate (Invariant 42 now covers this read)
