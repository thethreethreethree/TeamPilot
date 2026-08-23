# CHECK — desktop error-as-no-data + Door Log back

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  Test Files  569 passed | 1 skipped (570)
       Tests  3727 passed | 15 skipped (3742)
EXIT: 0
```

## What the tests prove
- **Desktop tiles (`homeDesktopStatsError.render.test.tsx`, NEW):** rendering the real home with a failing
  `/dashboard` fetch (macro OFF, LearningHint passing children through) shows "—" on the desktop stat tiles, never
  a false "0".
- **Door Log back (`DoorLogFlow.render.test.tsx`, +2):** in the IDLE state the "← Sales Coach" link renders and
  points at `/dashboard/sales-coach`; once recording starts it is gone (idle-only, no intrusion on the field flow).

## Honest limit
The desktop-tiles "—" is proven at the DOM level (the tiles read "—" under statsError); the exact per-tile mapping
beyond "the marker appears ≥4×" is the same statsError branch F4b already gates on the mobile pill. Door Log's back
target (`/dashboard/sales-coach`) is deterministic (a Link, not history), so no empty-history edge. This build is
the stated BOUNDARY — the remaining backlog is gold-plating (D3) / founder-scoped-out (D5) / founder-side (device
validation), not shipped here.

## Findings
No findings.
