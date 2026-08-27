# CHECK — Recommendation uptake

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3886 passed | 15 skipped (3901)
PIPE_EXIT=0
```

## Live probe (feasibility + the direction correctness)
Read-only probe against prod DB (temp script since deleted):
```
payloads: 152 · with a FLAGGED focus dimension: 60 · flagged keys: { talk_ratio: 52, question_rate: 8 }
duplicate (multi-view) summary rows collapsed: 15   (dedup matters)
  Moses  22 evaluable pairs · taken-up 13   (~59%)
  Johns   5 evaluable pairs · taken-up  4   (80%)
  others: 1-3 pairs → gate honestly
```
The FIRST probe (naive after>before) gave Moses 5/22 — the WRONG direction for talk_ratio. Direction-aware gives
13/22, which is the correct "talked less next session" reading.

## What the tests lock (A30)
- Direction correctness BOTH ways: talk_ratio (lower next = uptake) AND question_rate (higher next = uptake) — the
  inversion trap that nearly shipped.
- Chronological pairing from unordered input; append-only dedup (a session never pairs with itself); a pair is not
  evaluable when the next session didn't re-score the focus dim; gate below MIN_SESSIONS evaluable pairs; the
  parser picks the first flagged dimension with a known direction and excludes caveat scores.

## Not unit-gated (founder visual-verify)
- The tile rendering the uptake % on the /kpi page over live data. The compute + direction + gates ARE unit-gated.

## Findings
No findings — the metric is deterministic, direction-correct (verified against the source score engine + live
data), measures consequence not agreement (§3.5), and gates honestly until evaluable pairs exist.
