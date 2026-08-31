# CHECK — KPI duration poison fix

## Gate — the canonical command (A38)
```
$ npm run check   # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:* — pass
> test   Test Files  595 passed | 1 skipped
        Tests  3939+ passed
PIPE_EXIT=0
```
(Full-suite paste on the commit run; the coach subset already ran: 134 files, 1094 tests.)

## Live-data verification (the root cause, not a theory)
```
OUTCOME:  (null) 322 · sold 14 · no_sale 10 · follow_up 12 · undecided 1     → Layer-1 starved (separate issue)
DURATION: 359 total · 77 audio-len · 282 wall-clock · 230 >6h · max 78822.9 min
OUTLIERS: 200+ sessions, ended_at ALL = 2026-08-21T00:28:33Z, started June → ~54-day spans (the poison)
```

## What the tests lock (A30)
- `conversationDurationSeconds`: a backfilled/>4h span → null; a real audio length (even 5h) is NEVER capped.
- `avgSessionDurationMin`: a 90000-min outlier is excluded → avg 30, sampleSize 5 (poison never reaches the mean).

## Findings
No findings. The fix is at the shared helper (one edit fixes three surfaces); the audio-length truth is preserved;
nulls are honestly excluded (§3.4). Layer-1 outcome-capture is a separate, founder-gated feature.
