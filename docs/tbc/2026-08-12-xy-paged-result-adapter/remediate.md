# REMEDIATE — F1 duplicated + untested paged-result adapter

## F1 — the fetchAllPaged→{data,error} adapter was duplicated + untested
Root cause: this session's false-limit fixes each needed to adapt fetchAllPaged's throw-on-error back to the
Supabase `{data,error}` shape their Promise.all / §3.4 error-combines expect — so the same try/catch map got
written twice (admin's `pagedEventCount`, brain's inline `.then/.catch`), untested in both. Load-bearing (a broken
map swallows a read failure into a false empty) but unguarded.

Remediation (behaviour-preserving):
1. Add one exported `fetchAllPagedResult<T>(makePage, opts)` to paginate.ts — `try { data: await fetchAllPaged }
   catch → { data:null, error }` (non-Error throw wrapped).
2. Unit-test it both directions (success pages the full set → `{data, error:null}`; a read error →
   `{data:null, error:<Error>}` and never throws).
3. Wire both sites: delete admin's local `pagedEventCount` (3 call sites use the shared helper), replace brain's
   inline adapter. The §3.4 combines receive the identical shape — no behaviour change.

Boundary (A26): the routes' larger multi-read handlers remain without a full route test (pre-existing coverage
posture, low-consequence per the audit-provenance record). This guards the ADAPTER — the part actually introduced
this session.

Outcome: fixed. class: reuse/coverage consolidation. severity: low (regression + divergence prevention on
load-bearing error-propagation).
