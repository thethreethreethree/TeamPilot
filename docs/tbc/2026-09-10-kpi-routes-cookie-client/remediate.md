# REMEDIATE - give the KPI routes the caller's own client

### F1 - four routes authenticate a mobile caller and then read as nobody
gate-or-promise: gate
Each route now resolves `callerScopedDb(req) ?? (await createClient())`, and `quota`'s GET takes the request
so it can see an Authorization header at all. Two further routes with the same shape - `sales-session` GET and
`[id]/segments` POST - were closed rather than allowlisted, because an allowlist entry rots and a one-line fix
does not.

The gate is INVARIANT 26, widened (F2). A route that goes back to a bare cookie client fails
`npm run invariant:audit` by name, proven by mutation in check.md.

### F2 - the guard written for this exact class could not see it
gate-or-promise: gate
INVARIANT 26 now inspects the route's own body as well as the libraries it reaches, and counts BARE cookie
clients rather than matching the string - so the correct pattern, in both its spellings, is not flagged. The
widened rule reports 0 violations across 1012 files, and 1 the moment a fix is reverted.

### F3 - a recording can be written off as lost when its size merely could not be read
gate-or-promise: declined
No gate, and the hole is named: the code is in the native app repository, not this one, so nothing in this
audit can see it. More importantly the repair is not purely technical - the honest fix is to keep the marker
and retry on a later launch, which changes what a rep is told about a call that may or may not exist, and
that is the founder's decision rather than mine. It is recorded in check.md so the class boundary is on the
record, and it is surfaced to the founder with a recommendation rather than silently deferred.
