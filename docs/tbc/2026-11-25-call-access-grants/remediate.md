# REMEDIATE - An admin gives one teammate access to one call

### F1 - a shared view could reveal a trimmed section
gate-or-promise: promise (the shared page skips active trims; route returns them)
### F2 - a missing grant could confirm a call exists
gate-or-promise: gate (shared route test: 404, no reads)
### F3 - one of my own tests asserted nothing
gate-or-promise: gate (rewritten test)
