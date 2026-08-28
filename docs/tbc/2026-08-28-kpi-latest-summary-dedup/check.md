# CHECK — latest-summary-per-session dedup

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3896 passed | 15 skipped (3911)
PIPE_EXIT=0
```

## What the tests lock (A30)
- `latestSummaryPerSession`: multiple rows for one session collapse to the LATEST by created_at (no double-count);
  distinct sessions all survive; with no created_at it still collapses to one per session (last-seen wins).

## Not unit-gated (founder visual-verify)
- The live effect (a re-generated session now counting once on the /kpi page + roster). The helper + both route
  wirings are typechecked; the collapse logic is pure and unit-gated.

## Findings
No findings — read-side dedup matching the table's documented "latest is current" design; a required, safe
prerequisite for the objection backfill and a standalone accuracy fix for already-re-generated sessions.
