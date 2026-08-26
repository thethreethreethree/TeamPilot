# CHECK — P1: content-aware "Generate missing"

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest + artifacts + residual + freshness all ✓
  Test Files  578 passed | 1 skipped (579)
       Tests  3785 passed | 15 skipped (3800)
GATE_EXIT=0
```
(+2 backfill tests — empty-session exclusion / all-empty batch.)

## What the tests prove
- An empty (0-segment) session is EXCLUDED from `missing` and counted in `noContent`; the two WITH content are the
  only ones processed — no LLM call is burned on the empty one.
- A batch of all-empty sessions returns `generated 0 / remaining 0 / noContent 3` and calls the generator ZERO times
  — the exact founder symptom ("click generates 0") now surfaces the empties honestly instead of a frozen backlog.
- The 9 existing backfill tests still pass (dissect/attempt backoff, cap, thin-vs-generated split, after-pitch de-dup,
  scanBounded) — the change is additive.

## Data confirmation (recorded)
28203036 → 25 recoverable / 82 empty; c3e7f389 → 41 / 62 (real `coaching_transcript_segments` counts).

## Findings
No findings — diagnosed from data, the empty-capture pollution is removed at the shared core, the query is cap-safe,
and the empties are surfaced honestly (§3.4).
