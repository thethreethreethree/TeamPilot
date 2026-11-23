# CHECK - The manager's weekly coaching routine

## Commands

```
npx vitest run routine.test.ts + WeeklyRoutine.render.test.tsx → 3 passed
npm run check → exit 0 · Test Files 880 passed | 1 skipped · Tests 6559 passed | 15 skipped
```

## Findings

### F1 - earlier residuals said there was no component-test harness for remote-sales screens
class: a claim about the codebase recorded without checking.
sweep: `grep -rln "@vitest-environment jsdom" src/components/remote-sales/__tests__` → RemoteSalesShell, MacroCallView,
WeeklyRoutine.
severity: medium
