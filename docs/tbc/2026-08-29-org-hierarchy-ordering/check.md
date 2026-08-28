# CHECK — org-hierarchy ordering (stage 1)

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  593 passed | 1 skipped (594)
        Tests  3918 passed | 15 skipped (3933)
PIPE_EXIT=0
```

## What the tests lock (A30)
- `roles.test.ts`: the six tiers rank strictly in order; the existing vocabulary groups correctly (admin/CEO/CFO/COO
  → C-Suite, Lead → Supervisor/Team Lead, Member/staff → Frontline); case-insensitive ('Member'≡'member'); an
  unknown/null role sinks BELOW Frontline; `byOrgRank` sorts by tier then A→Z within a tier.
- The KPI team `route.authz.test` (A18) still enforces its exact key allow-list — now including `companyRole` — and
  its raw-score-leak assertions still pass, so the new field is an org label, not a score leak.

## Not unit-gated (founder visual-verify)
- The rendered order on each live roster. The rank/comparator are unit-gated; every surface's wiring is typechecked.

## Findings
No findings — one shared rank consumed by every team list; auth gates untouched; the privacy guard held.
