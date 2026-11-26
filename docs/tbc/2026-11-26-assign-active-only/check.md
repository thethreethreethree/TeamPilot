# CHECK - Training is only assigned to active people

## Commands

```
npx vitest run assignments course-assignments → 9 passed (inactive person refused)
npm run check → gates the commit
```

## Findings

### F1 - removed people could be assigned training by a direct call
class: a rule enforced in the picker only.
sweep: both assign routes.
severity: low
