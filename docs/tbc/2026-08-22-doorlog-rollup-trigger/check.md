# CHECK — Next Door focus: durable rollup trigger + visibility

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  553 passed | 1 skipped (554)
      Tests  3641 passed | 15 skipped (3656)
EXIT: 0
```

All gates exit 0. Worker + rollup-worker change; no schema/route change.

## Backfill verification (the existing-data half)
The founder-authorized backfill ran against the live DB: `rep_pattern_summaries` went 0 → 16 rows (4 reps ×
day/week/month/all_time), and a re-query confirmed a real Next Door focus string resolves (e.g. "When prospects
signal satisfaction… the pitches take that at face value and stop digging"). The LLM call was reproduced
directly against the 42 real pitches first (HTTP 200, valid JSON) to prove the pipeline before writing.

## What the unit tests prove
- The rollup is kicked on a pitch COMPLETION (carrying companyId/repId), and NOT on a failed pitch.
- H1 empty-audio guards + F4 skip-transcribe + double-processing prevention all still pass (no regression).

## Findings
**No findings.** Root cause proven (fragile sole trigger + silent swallow), fixed at the completion path with the
cron as backstop, and the silence removed.
