# CHECK - Erasure: say the short-name limit; take the bracket

## Commands

```
node scratchpad/replay0324.mjs (0322's scenario, 0324 applied last) → "Call Betty Ross at [removed] at 3" (was "([removed]") · other plans unchanged · name erase unchanged
npx vitest run ProtectionSettings.erasureDayPlans.render → 3 passed (client-name hint shown)
npm run db:apply → applied 0324 · DB now at 0324 · npm run verify:live → ALL 33 invariants hold
```

## Findings

No findings: both items were recorded residuals; each is closed by the change above.

## Final

```
npm run check → exit 0 · Test Files 899 passed | 1 skipped · Tests 6642 passed | 15 skipped
```
