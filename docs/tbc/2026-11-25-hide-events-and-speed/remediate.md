# REMEDIATE - A hidden call's AI reads are hidden too, and the hide checks run once per query

### F1 - a hidden call's AI reads were readable company-wide
gate-or-promise: gate (0341 rule on events; hideCoverage asserts events is guarded)
### F2 - the hide rules cost a function call per row
gate-or-promise: promise (timed on production before applying; no automated timing gate)
### F3 - NOT IN would have hidden every score with no call
gate-or-promise: promise (replayed; every rule in 0341 guards null)
