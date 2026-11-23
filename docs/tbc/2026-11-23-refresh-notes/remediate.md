# REMEDIATE - Refresh the AI notes after transcript corrections

### F1 - a refresh endpoint could run paid AI calls repeatedly
Guarded by the edit rights, a correction requirement, an audit row and a per-person rate limit.
gate-or-promise: gate (route tests for 403/409 and the audit row)
