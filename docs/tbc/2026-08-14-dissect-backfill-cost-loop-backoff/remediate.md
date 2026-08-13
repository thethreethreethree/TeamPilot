# REMEDIATE — dissect-backfill cost-loop backoff

## F1 — backoff marker stops the forever re-run
Remediation: `runAndStoreDissect` emits a `coach.dissect_attempted` event when the LLM RAN (agent turns ≥ MIN)
but produced no signal; `runDissectBackfill` excludes sessions carrying that marker within the last 14 days. A
stuck no-signal session therefore leaves the `missing` set → `remaining` reaches 0 (the manual button completes
honestly, §3.4), the daily cron stops re-spending its cap on the same sessions, and the session re-enters the
set after 14 days so a later corpus-trim can still recover it. Founder-chosen retry policy: backoff, N=14.
gate: `runAndStoreDissect.emit.test.ts` (emit only on LLM-ran-no-signal, not thin) + `dissectBackfill.test.ts`
(a recently-attempted session is skipped). class: cost / non-convergence. severity: high. Fixed.

## Design notes (on the record)
- Append-only (§3.1): the fix ADDS an event; the backoff STATE is derived by reading it, never a mutable flag.
- `events.kind` is free text (0004) and `coach.dissect_attempted` is not a `signal_sources` kind (0005), so the
  insert is accepted and derives no signal (correct) — no schema migration needed.
- Backoff (not permanent-skip): the founder chose to preserve eventual retry so a corpus-trim can recover the
  starved subset; a permanent skip would abandon those sessions.
