# REMEDIATE - Rank stage practice by what the rep misses

### F1 - the first element-id rule would have refused every real rubric id
0326's CHECK is ^[A-Za-z0-9_.]{1,80}$; the route also refuses any id not in REMOTE_RUBRIC.
gate-or-promise: gate (scenarios/elements route test refuses a made-up id; replay refuses a malformed one)
