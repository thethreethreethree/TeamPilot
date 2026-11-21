# REMEDIATE - RSS Phase 8

### F1 - revoked helpers in policies
0284 policies use auth_company_id() and an admin_roles() profile check, matching 0272-0283.
gate-or-promise: declined — rls:audit checks presence, not executability; executing each policy as `authenticated`
belongs in the sql-harness (OPEN.md item). Hole named there.

### F2 - trims that come back
The filter in the view (rss_line_trimmed, definer) plus copy_transcript_version for reprocessing; executed above.
gate-or-promise: gate (the existing "read transcripts from _current" invariant; 0284's header requires any later
view redefinition to keep the predicate)

### F3 - guessed retention
loadRetention fails closed; four cron tests pin it (own setting, smaller setting, unreadable, table missing).
gate-or-promise: gate (recording-purge-cron route tests)

### F4 - country code hid matches
Both the SQL search and normaliseIdentifier match the national part (last 10 digits) when more are given; the rerun
found the call. erasure.test.ts pins "+1 (555) 010-0123" → "5550100123".
gate-or-promise: gate (erasure.test.ts; the replay script's find assertion)
