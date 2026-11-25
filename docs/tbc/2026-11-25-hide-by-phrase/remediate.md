# REMEDIATE - A company phrase hides a call (stage 1)

### F1 - the audits couldn't see the new tables' row security
gate-or-promise: gate (rls:audit now reads 0338; allowlist entries name each writer)
### F2 - a grant or the library could open a hidden call
gate-or-promise: gate (shared route test; library skips hidden items, 500 if the check fails)
### F3 - a failed backfill read would say "checking 0 calls"
gate-or-promise: gate (route test "a failed recent-calls read says so")
### F4 - a missing service key in the phrase scan would break call processing
gate-or-promise: gate (hidePhrases.test "never throws": no key → null; failed read → null)
