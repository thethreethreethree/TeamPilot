# CHECK — schedule audit fixes

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test            Test Files  590 passed | 1 skipped (591)
                  Tests  3858 passed | 15 skipped (3873)
GATE_EXIT=0
```

## What this covers (each fix has a test that fails without it)
- **Import cap** — `upload/preview` returns 413 for a 1001-row grid (no OOM).
- **Authority enforcement** — EMPLOYEE_ASSIGNED double-booking → 422 (no write); phantom shift/employee → 409; a clean
  assign → 201; manager GET for a non-manager → 403.
- **Assistant honesty** — an empty response returns an honest system message (never "rephrase").
- **Split shift** — `buildWeekGrid` keeps both segments earliest-first (never last-wins-drops the earlier).

## Findings
No findings — each change is a code-confirmed fix from the audit; the judgment-dependent items were the founder's decision
(enforce absolutes; show both shifts; fix A+C+honesty-LOWs). Deferred LOWs recorded in closure R1.
