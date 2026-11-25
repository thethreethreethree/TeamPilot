# REMEDIATE - Name the speakers on a call

### F1 - a manager outside the tree could name speakers on a call
gate-or-promise: gate (invariant audit; route test: manager outside the tree → 403)
### F2 - a customer's name would survive legal erasure
gate-or-promise: gate (erasureCoverage test; replay)
### F3 - in-person transcripts would ask for names they can't store
gate-or-promise: gate (render test: no flag, no request)
