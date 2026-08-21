# CHECK — Meeting Coach server-side wiring

## Tests added
- `src/lib/coach/strategy/__tests__/resolveCoachingMode.test.ts` (2) — 1:1 kind mapping + safe-default of
  null/undefined/legacy/case-mismatch to `sales`.
- `src/lib/coach/strategy/__tests__/persistCueMode.test.ts` (2) — drift-guard: EVERY CueMode maps into the
  coaching_cues CHECK vocabulary (no meeting cue can produce an out-of-CHECK insert); directive→guide_response.
- `src/app/api/coach/meeting-session/[id]/cue/__tests__/route.test.ts` (7) — 401/404/403(non-owner)/400(sales
  session mis-routed); happy path runs the meeting brain + persists with the mapped mode; directive→guide_response
  at persist; silent decision persists nothing.

## Gate — the canonical command (A38), not a subset

```
$ npm run check
 Test Files  539 passed | 1 skipped (540)
      Tests  3563 passed | 15 skipped (3578)
EXIT: 0
```

All six gates (typecheck, lint, theme:audit, rls:audit, invariant:audit, test) exit 0. Sales Coach
regression-clean: the sales `/cue` route file is unchanged and its tests are in the passing set.

## Findings
**No findings** — no defects found in the wiring. One honest boundary (not a defect): migration 0237 is NOT applied to any live
DB — the code is A34-safe pre-apply (`mapSession` defaults `session_kind` to `sales`), and applying it is a
deliberate `npm run db:apply` step. End-to-end delivery (a real meeting cue reaching an earpiece) is
unverifiable without the capture layer + UI (Steps 6–7) and device hardware — the route is unit-proven; the
live loop is not yet wired.
