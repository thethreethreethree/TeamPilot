# CHECK — mobile back-nav affordance (F1/F2) + label de-collision (F3)

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  Test Files  568 passed | 1 skipped (569)
       Tests  3726 passed | 15 skipped (3741)
EXIT: 0
```

## What the tests prove
- **F1/F2 (`TopBar.render.test.tsx`, NEW):** on a non-tab SC route the mobile "← Back" renders (and the hamburger
  does not), clicking it calls `router.back()`; on the SC home the back button is absent (it's the hub); on a
  non-SC route the hamburger renders and no SC back button appears (the shared-component blast radius is contained).
- **F3 (`macroCardVisibility.render.test.tsx`):** the non-macro home shows "Pitch Analytics", and "Pitch
  Performance" is no longer present as a non-macro card (the collision is resolved).

## Honest limit
`router.back()` semantics (returns to the referring page) are exercised via the mocked router; the real
history-back behavior on device (card → page → back to Home) is the go-live eyeball. Door Log's separate back-nav
(it renders no TopBar) is out of this systemic fix's reach — flagged in the residual (the Home tab already returns
a macro rep there).

## Findings
No findings. The two founder-picked design fixes are built + test-locked; Door Log's back-nav is flagged as a
minor follow-up, not silently dropped.
