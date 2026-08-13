# BUILD — dissect-backfill cost-loop backoff

### runAndStoreDissect: emit the attempted (backoff) marker
read-path: `src/lib/coach/v5/salesDissect.ts` — `runAndStoreDissect` computes the dissect, then branches.
write-path: `hasSignal` → insert `coach.dissect_generated` (unchanged). ELSE if agent turns ≥ MIN_AGENT_SEGMENTS
(the LLM ran but produced no signal) → insert `coach.dissect_attempted` (append-only event, best-effort). Thin
sessions (0 agent turns → no LLM) insert nothing.

### runDissectBackfill: exclude recently-attempted sessions
read-path: `src/lib/coach/v5/dissectBackfill.ts` — after the `coach.dissect_generated` diff, query
`coach.dissect_attempted` events for the SAME bounded `subjects`, filtered `occurred_at >= now − 14d`.
write-path: none (read/derive). `missing = sessions not dissected AND not recently-attempted`, so a stuck
no-signal session leaves the set → `remaining` reaches 0 (the manual button completes) and the cron stops
re-spending. Re-enters after 14 days (a corpus-trim can still recover it).

## Test coverage
- `runAndStoreDissect.emit.test.ts` (3): hasSignal → `dissect_generated`; LLM-ran-no-signal → `dissect_attempted`;
  thin (0 agent turns) → NO insert (and the LLM isn't called).
- `dissectBackfill.test.ts` (7): + a session with a recent `dissect_attempted` marker is SKIPPED (only the
  non-attempted sessions are processed → no forever re-run); + both-dissected-and-attempted is excluded once
  (no double-count). Existing cap/drains/scanBounded behavior retained; the events mock now routes by `kind`
  and supports `.gte`.
