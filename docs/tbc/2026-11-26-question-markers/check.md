# CHECK - The rep's questions on the call page

## Commands

```
npx vitest run stats lib → 13 passed (markers agree with Questions / hour)
npx vitest run stats route + RemoteCallPanel → 7 passed
npx tsc --noEmit → clean
```

## Findings

### F1 - a question list that could disagree with the question rate
class: two rules for one decision.
sweep: one isQuestion for both (tested).
severity: low

## Final

```
npm run check → exit 0 · Test Files 963 passed | 1 skipped · Tests 6951 passed | 15 skipped
```
