# CHECK — verification is a command (A38)

## Targeted run (executed this session)
```
npx vitest run src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts
  → Test Files 1 passed (1);  Tests 48 passed (48);  EXIT: 0
```
The new "pins the sales handoff to the SALES extension id" assertion passes (47 → 48). Detection confirmed:
`grep -c "sales ? process.env.NEXT_PUBLIC_SALES_EXTENSION_ID : process.env.NEXT_PUBLIC_CARE_EXTENSION_ID"` on
`connect/page.tsx` = 1, and the regex pins the SALES/CARE ordering, so a swapped branch fails.

## Verification findings
The check phase surfaced **no findings** (no defects, no regressions). Test-only; the connect page is untouched.
Re-confirmed: the guard is calibrated (matches the current correct page) and discriminating (fails a crossed
ternary by construction).

## Full-gate output (A38 — pasted, with exit code)
```
$ npm run check   # tbc:docs·manifest·artifacts·residual·freshness · typecheck·lint·theme:audit·rls:audit·invariant:audit·test
 Test Files  371 passed | 1 skipped (372)
      Tests  2542 passed | 15 skipped (2557)
EXIT: 0
```
All eleven gates pass, exit 0. Full suite green with the id-source guard in place (2541 → 2542: +1 assertion).
