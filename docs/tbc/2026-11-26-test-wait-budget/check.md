# CHECK - One wait budget for every render test

## Commands

```
npx vitest run PitchPerformance.render (alone) → 2 passed, three times
npx vitest run testingLibraryBudget → 1 passed (getConfig().asyncUtilTimeout === 5000 in jsdom)
npx vitest run doorlog RecordingsTab vocabulary → 87 passed; tsc → clean; eslint → clean
```

## Findings

### F1 - a 1 s wait budget flakes under full-gate load
class: a budget measured on a quiet machine.
sweep: every DOM test, via setup.
severity: low
