# REMEDIATE - Say when the AI notes are older than the corrections

### F1 - a meeting or huddle would have been offered a refresh of sales AI notes it doesn't have (and the PUT accepted)
GET returns aiNotes = isSalesCall(sessionKind) and skips the notes read otherwise; the editor hides the prompt; PUT
refuses non-sales calls.
gate-or-promise: gate (invariant-audit isSalesCall rule; route test "a meeting or huddle has no AI notes: refused")

### F2 - the IDOR read-gate guard couldn't see a gate done in a same-file helper
sessionArtifactReadGate recognises same-file helpers that call getSession(); its own test covers a gating and a
non-gating helper.
gate-or-promise: gate (mutation-checked against transcript-edit's access())
