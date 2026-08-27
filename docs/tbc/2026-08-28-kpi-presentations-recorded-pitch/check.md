# CHECK — presentations = recorded pitches

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3870 passed | 15 skipped (3885)
PIPE_EXIT=0
```

## Live probe (the accuracy claim)
Read-only probe against prod DB (temp script since deleted):
```
Moses Maniquiz  knocked=95 sold=20
  OLD presentations (knocked-no_answer) = 46
  NEW presentations (count pitches, all-time) = 41      <- the founder's confirmed number
  period join-count (last 30d) = 41   (embedded-inner head:count WORKS)
Johns Ramos     knocked=6 sold=0
  OLD = 3 -> NEW = 3
```

## What this covers
- typecheck: the two functions' return shapes are unchanged (`presentations` / `conversations` stay numbers); the
  new count query + the dropped no_answer select compile; every consumer still reads the same field.
- invariant:audit — the honesty-throw keeps the "error-as-no-data" invariant intact (no swallowed 0), 0 violations.

## Not unit-gated (founder visual-verify + the un-named reliance)
- `getAllTimeKpi` / `getTodaysMetrics` are IO (server createClient); there is no existing unit harness for them, and
  the change is a DB-count that only reality can confirm. The number is confirmed by the LIVE probe above, not by a
  unit test. The card/dashboard rendering the new 41 is founder visual-verify.

## Findings
No findings — the source data is clean (view=raw, no dup knocks); the only inaccuracy was the presentations
definition, now the founder's chosen "recorded pitch", confirmed by the live probe.
