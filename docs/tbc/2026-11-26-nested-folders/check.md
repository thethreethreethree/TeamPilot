# CHECK - Nested library folders

## Commands

```
node replay0353.mjs → L1/L2/L3 OK; L4 REFUSED (three levels); another person's or the company's parent REFUSED; missing parent REFUSED; update ignored (no-update rule)
npx vitest run remote/library lib library.test → 23 passed (path find-or-create, 4 levels 400, restore once; paths; underArchived)
npx vitest run remote-sales/library → 1 passed (grouped by path; inside-archived not listed as empty)
npx tsc --noEmit → clean
```

## Findings

### F1 - a path's levels could resolve to one id and restore twice
class: duplicate events from a non-unique list.
sweep: the restore loop only.
severity: low

### F2 - flat-folder assumptions in archive, suggestions and the empty list
class: a structure change with readers that assumed the old shape.
sweep: every reader of the GET folders list (Library page, call page suggestions).
severity: low
