# CHECK — door home screen, Phase 05

## Findings
**No findings.** This is a pure, self-contained module with no caller yet; the only judgement calls (starter
ratios, floor/ceiling, "enough data" threshold) are documented as founder-vetoable defaults in INSPECTION.md.

## The gate bites (mutation, A38)
```
$ (mutate) dayTarget.ts: ceilPos → Math.floor (round DOWN instead of UP)
$ npx vitest run src/lib/coach/doorlog/__tests__/dayTarget.test.ts
 × goal 2, close 1/9, contact 1/4.4, qualified → 18 presentations, 80 doors (rounds UP; 79.2 → 80)
   AssertionError: expected 79 to be 80
      Tests  4 failed | 6 passed (10)
$ (restore)
      Tests  10 passed (10)
```

## Canonical command
```
$ npm run check
  typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
  invariant audit: 0 violations
  tbc: docs · manifest · artifacts · residual · freshness — clean
  Test Files  629 passed | 1 skipped (630)
       Tests  4160 passed | 15 skipped (4175)
  Duration    50.42s
EXIT_CHECK=0
```
