# CHECK — View session usage

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (12) + artifacts + residual + freshness all ✓
  Test Files  583 passed | 1 skipped (584)
       Tests  3824 passed | 15 skipped (3839)
GATE_EXIT=0
```

## Confirmed against REAL prod data (the strongest check here)
`node scripts/diag-view-session.mjs .` (read-only):
- OLD manager view (`/recordings`, audio + 2 days): Knute Knudtson → 0.
- NEW `rep-activity` query (30 days, any audio): Knute → 44 sessions.
- `team-activity` aggregate: Knute 44 (last Aug 18), Anthony 53 (Aug 18), John 9 (Aug 18) — the exact reps reported.

## Not unit-tested (bounded honestly, A30 note)
Both routes are integration-shaped (admin DB reads); the fix is the ABSENCE of the audio filter + a wider window, which
has no pure-function seam to unit-test. The lesson ("the usage view must NOT filter on audio") is encoded in the route
docblock + closure and PROVEN against real data (0 → 44). The authz mirrors the tested `/recordings` gate
(isSalesCoachManager + canManagerViewRepSkills), which is already unit-tested. The manager-view render is presentation.

## Findings
No findings — a layer-2 fix that makes "monitor usage" actually work, verified on the real reps; §A18 activity-not-rank;
§3.4 honest empty; the Alejandro cross-company setup issue flagged, not silently changed.
