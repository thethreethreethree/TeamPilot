# CHECK — Practice analytics

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (13) + artifacts + residual + freshness all ✓
  Test Files  581 passed | 1 skipped (582)
       Tests  3808 passed | 15 skipped (3823)
GATE_EXIT=0
```
(+9 practiceAnalytics tests.)

## What the tests prove (practiceAnalytics — the honesty/§A18 seams)
- Honest empty on no practice (null latest/trend, never a fake 0).
- Trend is a DIRECTION from first→latest APPLIED score with a ±6 threshold (up/flat/down); null under 2 applied points.
- applied:false counts as activity but contributes NO score (a skill never reached has no meaningful number).
- Scores clamped 0-100; malformed rows dropped; byFocus ordered most-recently-practiced first; rows sorted chronologically.
- The MANAGER summary exposes ONLY {attempts, latest, trend} — no per-focus score list leaks to the leader view (§A18).

## Precondition (§1.5.3) — checked, not assumed
The write depends on the events schema. 0004_events.sql: `kind text not null` (no CHECK; `coach.*` kinds already
write), `subject not null` (set to `practice:<repId>`), admin client bypasses RLS. The append lands — no migration.

## Not unit-tested (bounded honestly)
The event write + the two route reads are integration-shaped (admin DB); the aggregation they feed is fully tested, the
write mirrors salesDissect's proven insert, and the UI is presentation over the tested aggregate. Live end-to-end
(a real scored practice appears in the trend) is founder visual-verify.

## Findings
No findings — additive, append-only (§3.1), precondition-checked, honest empties, §A18 growth-not-rank enforced and
tested. Default roleplay path unchanged.
