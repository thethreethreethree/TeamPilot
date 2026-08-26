# CHECK — Training tab

## Gate — the canonical command (A38)
```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest (10) + artifacts + residual + freshness all ✓
  Test Files  579 passed | 1 skipped (580)
       Tests  3790 passed | 15 skipped (3805)
GATE_EXIT=0
```
(nav test updated to assert the new Team-Tools order Roleplay → One Liners → Training → Team.)

## What this slice's tests + typecheck prove
- Typecheck clean across the new route, shared panel, Training page, and the Coach Assessment refactor (the inline
  brief copy removed, replaced by the shared panel — no dangling references).
- The manager team route stays manager-gated (unchanged); `my-training` is self-data (actor = caller), no manager gate.

## Not unit-tested (bounded honestly)
The Training page is a role-branched fetch-and-render surface with no new pure logic; its data comes from routes that
already back the Coach Assessment view (whose aggregation is tested). The honest empty states are simple conditional
render. `my-training` mirrors the tested aggregation shape (`aggregateDissectContent`) with the same degraded-on-error
contract as its sibling.

## Findings
No findings — the slice is a surface + a self-data route over existing, tested signal; it removes drift (one shared
brief panel) rather than adding it, and role-branches so neither role dead-ends.
