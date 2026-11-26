# CHECK - Assign pickers list only reps the manager may assign

## Commands

```
npx vitest run assignable-reps Courses.render TrainingManager → 10 passed
node scripts/invariant-audit.mjs → 0; npx tsc --noEmit → clean
npm run check → gates the commit
```

## Findings

### F1 - pickers offered reps the routes refuse
class: a choice list wider than the action's rule.
sweep: both Assign pickers (courses, scenarios).
severity: low
- npm run check → every step green except 11 test files that never started (vitest worker start timeout, load); rerun alone → 11 files / 91 tests passed
