# CHECK — verification is a command (A38)

## Targeted run (the exemption + its blast-radius guard)
```
npx vitest run src/lib/care/__tests__/extensionEntitlement.test.ts
 Test Files  1 passed (1)
      Tests  28 passed (28)     # +2 vs pre-fix: home→active, customer→locked
```

## Findings
No findings. The exemption returns before any IO (pure identity check), so it's DB-free and the two new tests
run without an admin-client mock for the vendor case. Detection-true: on the pre-fix code the home tenant fell
through to the plan/trial read and returned `locked`/`trialEnded`, so both tests fail without the exemption.
Ripple confirmed single-caller (extensionAuth → both extensions); no other consumer branches on `plan`.

## Full-gate output (A38 — canonical command by name, pasted with exit code)
```
$ npm run check   # tbc(docs·manifest·artifacts·residual·freshness) · typecheck·lint·theme:audit·rls:audit·invariant:audit·test
 Test Files  373 passed | 1 skipped (374)
      Tests  2549 passed | 15 skipped (2564)
EXIT: 0
```
All gates pass, exit 0. Test count 2547 → 2549 (+2 exemption tests).
