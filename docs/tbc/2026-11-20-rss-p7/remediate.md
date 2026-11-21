# REMEDIATE - RSS Phase 7

### F1 - ON CONFLICT on rule tables
Plain inserts: single-row sites treat 23505 as already stored (followThrough reads the raced row back); batch sites
read the keys already stored and insert only the rest; the assignments route answers 409 on a concurrent duplicate
and reports `assigned` / `alreadyAssigned` honestly. trackerScan's test now fails if `.upsert` is called on
tracker_hits and covers the re-scan. INVARIANT 33 drops the ignoreDuplicates exemption and says why.
gate-or-promise: gate (INVARIANT 33, scripts/invariant-audit.mjs)

### F2 - sql:harness empty reason
The probe never returns an empty reason: AggregateError's inner messages, then the code, then a fixed sentence.
gate-or-promise: declined — the harness is itself the gate; a test of the probe needs a refusing socket, more
machinery than the one-line fix. Hole: another empty-message error type could recur; the comment names the class.

### F3 - 1000-row cap
fetchAllPagedResult for the two aggregate reads; call search caps at 1000 and sets `narrower`, which the search page
shows ("more calls may match … narrow it").
gate-or-promise: gate (existing INVARIANT, now 0 violations)

### F4 - session length
conversationDurationSeconds in both routes.
gate-or-promise: gate (existing INVARIANT)

### F5 - CSV
callSearchCsv builds through toCsv.
gate-or-promise: gate (existing INVARIANT 1)

### F6 - CWE-209
Fixed sentence for every TreeError.
gate-or-promise: gate (existing INVARIANT)

### F7 - never compiled
Fixed in place; typecheck / lint / test now run on this machine.
gate-or-promise: gate (npm run check)
