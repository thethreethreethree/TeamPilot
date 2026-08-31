# BUILD — KPI duration poison fix

### Fix 1: cap the wall-clock in the shared duration rule
- write-path: `conversationDuration.ts` — new `MAX_WALLCLOCK_SECONDS` (4h); the wall-clock branch returns null when
  the span exceeds it. The audio-length branch is untouched (trusted real length, never capped).
- read-path: the After-Pitch header, the Sessions list, AND the KPI avg-duration all read this one helper (audit
  F8), so a backfilled/unclosed session now reads "unknown" everywhere instead of 54 days.

### Fix 2: average only over KNOWN durations
- write-path: `compute.ts avgSessionDurationMin` — map each session to its duration, filter out nulls, gate on the
  valid count, average over valid only. A null is excluded from BOTH numerator and denominator (not a 0-min call).
- read-path: the KPI card shows a real minutes figure; the poison sessions neither inflate (old bug) nor deflate
  (the `?? 0` denominator bug) the average.

### Gates (A30)
- write-path: `conversationDuration.test.ts` (+cap/backfill/never-cap-audio cases), `compute.test.ts` (+90000-min
  outlier excluded → avg 30, sampleSize 5).
- read-path: a future edit that drops the cap or the exclusion fails these instead of shipping a 32051.9 again.

## Files
- `src/lib/coach/conversationDuration.ts` — MAX_WALLCLOCK_SECONDS + cap
- `src/lib/coach/kpi/compute.ts` — avgSessionDurationMin excludes null durations
- `src/lib/coach/__tests__/conversationDuration.test.ts`, `src/lib/coach/kpi/__tests__/compute.test.ts` — guards

## Ripple (§6 item 5)
- The cap lives in the SHARED helper, so After-Pitch + Sessions list + KPI are all fixed with no per-surface edit
  (the whole point of the F8 consolidation). No display code changed. Layer-1 "building" is a separate root cause
  (no outcome-capture path) surfaced to the founder as a decision, not touched here.
