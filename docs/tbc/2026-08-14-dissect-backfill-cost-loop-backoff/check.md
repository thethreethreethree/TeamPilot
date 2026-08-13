# CHECK — dissect-backfill cost-loop backoff

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — the dissect-backfill re-runs a full LLM call on stuck no-signal sessions forever
file+line: `src/lib/coach/v5/salesDissect.ts:132` (stores the done-marker ONLY on `hasSignal`) +
`src/lib/coach/v5/dissectBackfill.ts:88` (marks "missing" on the absence of that marker). A session that ran the
~20s LLM but produced no signal (starved / tone-law / empty-with-turns) stores nothing, stays "missing", and is
re-run every cron pass. The manual "Generate missing" button (told to "run until remaining=0") can never reach 0
when ≥ cap such sessions exist — each click is a fresh ~6× LLM batch of immediate metered spend.
class: cost / non-convergence (recurring metered LLM spend + a misleading "run until 0" admin UX).
severity: high (real recurring $ + user-triggered unbounded spend on the manual path).
read-path: fixed by a `coach.dissect_attempted` backoff marker (emitted when the LLM ran, no signal) that the
backfill excludes for 14 days.
sweep-command: `grep -n "coach.dissect_attempted\|recentlyAttempted\|ATTEMPT_BACKOFF_DAYS" src/lib/coach/v5/salesDissect.ts src/lib/coach/v5/dissectBackfill.ts`
— confirms the marker is emitted and the backfill excludes it.

## Full cron-sweep note (on the record, from the originating audit)
`backfill-dissects-cron` was the ONLY expensive non-convergence instance among the 7 crons in vercel.json; the
other six (durability-sweep, finance/reports/deliver, task-overrun-sweep, care/rcd/retention, recording-purge,
kpi/compute) converge by nature (cheap deduped / period-bounded / idempotent / deletions). No further cron fix
needed.

## Tests
```
$ npx vitest run runAndStoreDissect.emit dissectBackfill
 Test Files  2 passed (2)   ·   Tests  10 passed (10)
```
Emit cases (generated / attempted / thin-nothing) + the backoff exclusion are locked. Full gate result in
closure.md.
