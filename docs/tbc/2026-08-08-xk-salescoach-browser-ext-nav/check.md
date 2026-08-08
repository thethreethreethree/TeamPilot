# CHECK — verification is a command (A38)

## Targeted runs (executed this session)
```
npx tsc --noEmit                                                              → EXIT 0 (no SalesCoachShell errors)
npx vitest run src/components/sales-coach/__tests__/salesCoachShellNav.test.ts
  → Test Files 1 passed (1);  Tests 3 passed (3);  EXIT: 0
```
Typecheck passes with the new `external` field + render branch. The 3 nav-parity tests pass: the entry exists,
points at `/extension/download-sales`, is `external: true` with a new-tab render, and C.A.R.E still carries the
mirrored pattern.

## Verification findings
The check phase surfaced **no findings** (no defects, no regressions). Re-confirmed:
- Non-external nav items are behavior-unchanged (the target/rel spread is `{}` for them; active-state only gains
  a `!item.external` guard, which is false for all existing items → no change).
- Mobile tab bar untouched (extension correctly desktop-only).
- The download page, inline dashboard cards, and served zip are untouched — this only ADDS the nav surface.

## Full-gate output (A38 — pasted, with exit code)
```
$ npm run check   # tbc:docs·manifest·artifacts·residual·freshness · typecheck·lint·theme:audit·rls:audit·invariant:audit·test
 Test Files  372 passed | 1 skipped (373)
      Tests  2545 passed | 15 skipped (2560)
EXIT: 0
```
All eleven gates pass, exit 0. Full suite green with the nav entry + its parity guard in place (2542 → 2545:
+3 nav-parity tests; +1 test file).
