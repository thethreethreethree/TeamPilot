# CHECK — roster-ordering completeness

## Gate — the canonical command (A38)
```
$ npm run check   # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  595 passed | 1 skipped (596)
        Tests  3935 passed | 15 skipped (3950)
PIPE_EXIT=0
```

## What the tests lock (A30)
- `team.fetchTeam.test`: scrambled multi-tier roster → CEO/VP/Director/Manager/Supervisor/Member order, name
  tiebreak, unknown role sinks last.
- `sales-session/team/route.test`: GET roster ordered by org hierarchy regardless of DB return order.
- `careCoachAssessment.test`: role-present agents ordered by tier (role-less fall back to alphabetical, preserving
  the §A18 not-graded property).

## Not unit-gated (founder visual-verify)
- The three rendered surfaces (Sales-Coach + C.A.R.E coach-assessment pages, and the /api/team-fed pickers) — the
  sort SOURCE (byOrgRank) is unit-tested; the wiring is typechecked. The CFO now appearing on the C.A.R.E coach
  roster is a live-data visual check.

## Findings
No findings. Org ordering is compatible with §A18 (not a grade); the CFO membership widening is additive and
founder-approved; all fixes reuse the single unit-tested primitive.
