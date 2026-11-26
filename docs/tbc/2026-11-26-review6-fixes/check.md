# CHECK - Acting on the review of nested folders

## Commands

```
npx vitest run remote/library remote-sales/library → 16 + 2 passed (ancestor restored on add by id; no dead Restore)
npx tsc --noEmit → clean
```

## Findings

### F1 - add by id didn't restore archived ancestors
class: two writers of one rule.
sweep: the name path already did; now both do.
severity: low

### F2 - Restore inside an archived folder did nothing visible
class: a control whose effect the screen hides.
sweep: the archived list only.
severity: low

### F3 - old folder names containing '/'
class: a meaning change for existing data.
sweep: production count 0.
severity: low

### F4 - two simultaneous saves of a new path can duplicate a level
class: lookup-then-insert without a unique key.
sweep: pre-existing for top-level folders; later saves settle on the oldest.
severity: low
