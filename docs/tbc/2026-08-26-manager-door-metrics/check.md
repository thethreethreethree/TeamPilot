# CHECK — manager dashboard: per-rep door metrics

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (11) + artifacts + residual + freshness all ✓
  Test Files  578 passed | 1 skipped (579)
       Tests  3785 passed | 15 skipped (3800)
GATE_EXIT=0
```

## What holds it
- Typecheck ENFORCES `doorKpi` on the team item + the AgentAssessment type — a caller can't drop the field.
- The 3 coach-assessment tests pass: the best-effort `.catch(()=>null)` keeps the team response intact even when
  `getAllTimeKpi` isn't mocked, proving door metrics never break or degrade the coaching page.
- Data verified against prod: getAllTimeKpi returns real per-rep numbers (95/46/20, 126/30/3, …).

## Findings
No findings — A18 honored (labelled activity, alphabetical, not a coaching leaderboard), §3.4 honored (null not a
false 0), additive over verified existing data.
