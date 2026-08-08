# CHECK — verification is a command (A38)

## Targeted run (the drift guard, executed this session)
```
npx vitest run src/lib/coach/extension/__tests__/salesExtensionConfigWiring.test.ts
  → Test Files 1 passed (1);  Tests 26 passed (26);  EXIT: 0
```
All 6 coach/extension routes satisfy the new guard: 5 tool routes contain `guardExtensionRequest`, `refresh` is
exempt. Detection proven separately: `grep -c guardExtensionRequest .../refresh/route.ts` = 0, so the exemption
is load-bearing (remove it → refresh fails the assertion), i.e. the guard fails an ungated route.

## Verification findings
The check phase surfaced **no findings** (no defects, no regressions). Test-only addition; no route touched.
Re-confirmed: the guard is calibrated (6/6 pass) AND discriminating (fails an ungated route by construction).

## Full-gate output (A38 — pasted, with exit code)
```
$ npm run check   # tbc:docs·manifest·artifacts·residual·freshness · typecheck·lint·theme:audit·rls:audit·invariant:audit·test
 Test Files  371 passed | 1 skipped (372)
      Tests  2541 passed | 15 skipped (2556)
EXIT: 0
```
All eleven gates pass, exit 0. Full suite green with the drift guard in place (2535 → 2541: +6 route cases in
the `it.each`).
