# CHECK - Rename a call from its page

## Commands

```
npx vitest run RenameCall + sales-session [id] authz → 9 passed
npx tsc --noEmit → clean
```

## Findings

### F1 - the control could send a status change
class: reusing a route that also ends calls.
sweep: the body is {clientLabel} only (tested).
severity: medium

### F2 - managers would see a control that always fails
class: a control shown to people the route refuses.
sweep: shown only to the call's rep.
severity: low

## Final

```
npm run check → exit 0 · Test Files 962 passed | 1 skipped · Tests 6926 passed | 15 skipped
```
