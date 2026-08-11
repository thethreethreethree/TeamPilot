# CHECK — Sales Coach collapsible nav groups

## Verification run (A38 — canonical command + exit code)
Canonical command: `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc
&& test).

## Findings
None. This is a presentation-layer restructure that reuses the existing section model + manager-filter helper
and mirrors CareShell's expander; both hypotheses (manager-filter break, extension-parity break) were refuted
by reading the helper + the parity test (think.md §6), and 6 new structure tests were added. Because there are
no findings, there is no remediate.md. Items checked with nothing to fix: manager-only gating still hides Coach
Assessment + Team from reps; MOBILE_TABS untouched; browser-extension parity preserved.

## Targeted: nav structure + parity tests
```
$ npx vitest run src/components/sales-coach/__tests__/salesCoachShellNav.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

## Full gate
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Files scanned 770 · Documented exceptions 40 · Violations 0
tbc ✓ — docs · manifest (12) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 394 passed | 1 skipped (395); Tests 2721 passed | 15 skipped (2736)
CHECK_EXIT=0
```
