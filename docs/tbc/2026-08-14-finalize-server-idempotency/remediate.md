# REMEDIATE — /finalize server-side idempotency

## F1 — guard the five-engine generation on the dissect marker
Remediation: `/finalize` reads whether a `coach.dissect_generated` event exists for the session before
generating; if so it appends the transcript (idempotent) and returns `{ alreadyGenerated: true }` without
re-running the five DeepSeek engines. A failed first generation leaves no marker, so a genuine retry still runs.
This mirrors `/label-transcript`'s server-side gate and reuses the same marker the backfill cron keys on.
gate-or-promise: gate. The finalize route test asserts `runAndStoreDissect` is NOT called when a prior dissect
marker exists (and IS called on the first finalize) — removing the guard reddens CI.
class: cost / server-idempotency. severity: medium. Fixed.

## Deferred (finding ④ — retranscribe)
`/retranscribe` needs a different mechanism (its result is ephemeral + it is re-runnable by design), so its
de-dup requires new persisted state (a cached diarization result or a per-session auto-fire marker = a migration).
Flagged for a dedicated build rather than rushed here.
