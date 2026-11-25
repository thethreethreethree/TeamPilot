# CHECK - Connect rate per rep

## Commands

```
npx vitest run TeamUsage + usage lib + usage route + outcomeLabels → 19 passed
node outcomes.mjs (production, counts only) → phone/video outcomes: [{"outcome":"(none)","n":12},{"outcome":"follow_up","n":1}]
npx tsc --noEmit → clean
```

## Findings

### F1 - a connect rate over every session kind
class: a ratio whose base mixes kinds.
sweep: only phone/video calls are judged (route test with a door pitch).
severity: medium

### F2 - a call with no outcome counted as not reached
class: absence read as a value.
sweep: null is not counted (rule and counting tests).
severity: medium

## Final

```
npm run check → exit 0 · Test Files 961 passed | 1 skipped · Tests 6924 passed | 15 skipped
```
