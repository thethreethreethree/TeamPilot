# BUILD — Pitch worker: derived-table write honesty (audit H3)

### the derived writes throw on error, so a lost write can't be dressed as "complete"
- write-path: `writePitchTranscript` / `writePitchAnalysis` / `setPitchStatus` now capture `{ error }` and call
  `assertNoWriteError(error, op)` → throw on a Supabase error instead of ignoring it. Because `complete` is written
  only AFTER `writePitchAnalysis` returns, a throwing analysis write routes into the worker's catch → retry →
  honest terminal `failed`; it can no longer be outrun by the status flip.
- read-path: `PitchDetail` renders a truthful "Analysis unavailable — this pitch finished, but its analysis didn't
  save" (amber, with the transcript still shown) when `status === "complete"` but `analysis` is null — instead of
  the old "Still processing…" that would spin forever on a terminal pitch.

## Contract preservation
`processPitch` must never throw (its doc + the cron loop). Its FAILURE-path status writes (the H2 poison gate + the
catch) now go through `recordFailureStatus`, which swallows a persist error + reports to Sentry (the lease-expiry +
cron re-claim is the backstop). Happy-path status writes stay inside the `try`, so their throws are caught + retried.

## Files
- `src/lib/data/doorlog.ts` — `assertNoWriteError` + the three writes throw on `error`.
- `src/lib/coach/doorlog/worker.ts` — `recordFailureStatus` best-effort helper; poison gate + catch route through it.
- `src/components/sales-coach/doorlog/PitchDetail.tsx` — honest complete-without-analysis branch.
- tests: `doorlog.writeHonesty.test.ts` (4, new); `worker.test.ts` (+1: no 'complete' on a failed analysis write);
  `PitchDetail.render.test.tsx` (+1: 'Analysis unavailable', no forever-spinner, transcript still shows).

## Ripple (§1.5)
The three helpers are used ONLY by the worker (grepped). No schema change, no migration — deployable now. Retries
are safe: the writes are idempotent upserts.
