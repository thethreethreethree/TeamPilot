# BUILD — Next Door focus: durable rollup trigger + visibility

### completion-path rollup kick (the durable trigger)
- write-path: `processPitch` (`worker.ts`), after `setPitchStatus("complete")`, calls
  `after(() => rollupRep({ companyId, repId, todayIso }))` — fires on EVERY completion (route kick AND cron),
  wrapped in try/catch (a direct/test invocation with no request context → skip; cron pass is the backstop).
- read-path: `getTodaysMetrics` reads the freshly-upserted `rep_pattern_summaries` → the Next Door focus +
  Opportunities render.

### rollup failure visibility (A30 / INV22)
- write-path: `rollupWorker.rollupRep`'s per-period catch now `console.error`s the failure instead of swallowing
  it silently (the silence is why the empty focus hid despite analyzed pitches).
- read-path: n/a (server log surface).

## Files
- `src/lib/coach/doorlog/worker.ts` — import `after` + `rollupRep`; kick the rollup on completion.
- `src/lib/coach/doorlog/rollupWorker.ts` — log the swallowed per-period rollup error.
- `src/lib/coach/doorlog/__tests__/worker.test.ts` — +2 tests: rollup kicked on completion (with companyId/repId);
  NOT kicked when the pitch fails.

## Reuse
Reuses `rollupRep` (the exact cron logic) and the `after()` mechanism already used to kick pitch processing —
no new rollup logic. The cron's `rollupDueReps` pass remains an idempotent backstop. No schema change.
