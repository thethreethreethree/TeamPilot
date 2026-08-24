# CHECK — "View last pitch result" button after ending a Door Log session

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  tbc: docs + manifest + artifacts + residual + freshness all ✓
  Test Files  575 passed | 1 skipped (576)
       Tests  3755 passed | 15 skipped (3770)
EXIT: 0
```
(+2 test files, +6 tests vs the prior build's 573/3749 — the 4 redirect-page cases + the 2 Door Log render cases.)

## What the tests prove
- **`latest/__tests__/page.test.ts` (NEW, 4):** the redirect page sends the rep to their most recent pitch's
  DETAIL; and to the Pitch Performance list on no-pitch / read-error / unauthenticated — an honest fallback,
  never a dead end. Fails if the redirect target regresses.
- **`DoorLogViewResult.render.test.tsx` (NEW, 2):** the "View last pitch result" link is ABSENT before any pitch,
  PRESENT (with `href=/doors/report-card/latest`) after a real recorded pitch is saved, and ABSENT when the save
  dropped to a knock (no audio → no result → §3.4 honesty). Fails if `justSavedPitch` mis-gates the affordance.
- **Ripple check:** the existing `DoorLogFlow.render.test.tsx` re-ran 1-of-1 (with the 6 new tests, 7-of-7) — the
  static-`<Link>` design added no navigation-hook dependency, so no existing Door Log render test broke.

## Findings
No findings — a clean feature build. The one in-build course-correction (useRouter ripple → redirect page) is
recorded in build.md.
