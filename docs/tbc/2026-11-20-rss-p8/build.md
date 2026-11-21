# BUILD - RSS Phase 8: protection

Migration 0284. D14 open → no retention row keeps today's 20. D15 open → no redaction. Erasure job not built
(see closure R1).

### Audit log
write-path: recordAudit (src/lib/audit/recordAudit.ts, service role) after the action succeeds, from: pitch-score
re-score, pitch-score/override, delete-recording, call-search CSV export, trim, trim restore, retention change →
audit_log (0284; a trigger refuses update/delete for everyone). INVARIANT 37 fails any route that removes audio,
changes a score, writes a trim/retention/erasure row or exports a sales-coach CSV without calling recordAudit.
read-path: GET /api/coach/remote/audit (company admins; caller's client, so 0284's read rule applies too) →
ProtectionSettings "Audit log" on Settings → Protection.

### Recording retention
write-path: PUT /api/coach/remote/settings/retention (company admins) → company_recording_settings row + audit row.
read-path: recording-purge-cron reads the latest row per company through loadRetention (fails closed: an unreadable
table purges nothing; a missing table means D14's 20) → keepFor per session's company; GET for ProtectionSettings.

### Trim and restore
write-path: POST /api/coach/remote/[id]/trim (managers, tree, never own call, refused for untimed transcripts) →
recording_trims / recording_trim_restores row + audit row + copy_transcript_version + generateSessionArtifacts after
the response.
read-path: coaching_transcript_segments_current excludes lines inside active trims (rss_line_trimmed, definer) for
every reader and version; GET /api/coach/remote/[id]/trim → RemoteCallPanel skips trimmed ranges in playback and
lists them with Restore.

### Settings → Protection tab
write-path: none of its own (the retention Save above).
read-path: settings route's isCompanyAdmin verdict (isAdminRole) → the tab; ProtectionSettings reads retention and
the audit log; erasure shows the current manual route (privacy@elostate.com).

## Addendum 2026-11-20 — erasure, after the founder's picker ("Amend §3.1, build it")

AMD-014 ratified (CLAUDE.md §3.1.1); migration 0285; erasure_requests in 0284 now stores a keyed hash + masked hint.

### Erasing a customer's data
write-path: Settings → Protection → find (POST /api/coach/remote/erasure {action:"find"} → rss_erasure_matches) →
review → erase ({action:"erase"}: the search runs again and only its results may be erased → erasure_requests row
(HMAC hash + hint) → recording files removed (any failure stops before the database) → rss_erase_sessions (one
transaction: delete the customer's words, blank the rest, erasure_completions row) → audit row).
read-path: the deleted rows are gone for every reader; the blanked session keeps rep, outcome and score; the audit log
shows "asked for a customer's data to be erased · phone ••••0123, 1 call". INVARIANT 38: no other file may call
rss_erase_sessions or set rss.erasure.
