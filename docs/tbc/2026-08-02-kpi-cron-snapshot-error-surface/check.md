# CHECK — KPI compute-cron snapshot-error surfacing

## Audit (H1)
- On `insErr`, the loop now increments `snapshotErrors` and `console.error`s the agent/metric/period; the run
  returns `snapshotErrors`. A dropped snapshot is therefore visible three ways (log, counter, response field)
  instead of zero. Happy path unchanged: `snapshots += 1` on success.
- No compute change: `fn(rows)` and the `periods` logic are untouched, so no metric VALUE changes — only the
  visibility of a write failure.

## Class sweep (A26)
All 7 crons checked. retention (`storageErrors`), purge (`assetErrors`/`malformed`), backfill / task-overrun /
durability (outer try/catch), finance deliver-cron (fixed in the previous commit). KPI was the sole remaining
swallowed-write-error. Boundary closed.

## Findings (A26)
Two adjacent issues found and FLAGGED (not fixed here — each needs a decision, §3.3):
1. **`sessionsPerDay` counts distinct days by `startedAt.slice(0,10)` = UTC days** (compute.ts:125). A rep
   working 9–5 in a west-of-UTC zone straddles two UTC dates per workday, ~halving their sessions-per-day.
   This runs LIVE in the agent's on-read view, not only in the dormant cron. Fix needs a timezone source
   (not stored) and is a product-semantics call ("whose day defines the bucket?"). Flagged to the founder queue.
2. **`kpi_snapshot` has no unique constraint on (agent_id, metric, period)** — which is why persistence is
   delete-then-insert rather than an atomic upsert. The robust fix (unique constraint + `upsert`) removes the
   data-loss window entirely but is a migration (gated). Flagged.

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no errors; no compute-cron lines) tsc_exit=0
```
Full `npm run check` is the CI gate on push.
