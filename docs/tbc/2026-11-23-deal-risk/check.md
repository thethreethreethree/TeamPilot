# CHECK - Deal risk and forecast

## Commands

```
npx vitest run src/lib/coach/remote/__tests__/dealRisk.test.ts → 8 passed, exit 0
npx tsc --noEmit -p . → exit 0
```

## Findings

### F1 - the thresholds are product choices, not measured
class: fixed numbers (21 days, 14 days, 2 reasons, 5 closed deals) chosen without outcome data.
sweep: `grep -n "QUIET_DAYS\|NEW_GRACE_DAYS\|MIN_CLOSED_FOR_FORECAST" src/lib/coach/remote/dealRisk.ts` → one place,
stated on screen.
severity: low

### F2 - the Ask box does not know a deal's risk
class: a derived fact one surface shows and another can't use.
sweep: `grep -n "dealRisk" src/lib/coach/remote/askPipeline.ts` → none.
severity: low
