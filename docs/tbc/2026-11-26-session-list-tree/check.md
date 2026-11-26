# CHECK - The session list follows the reporting tree

## Commands

```
npx vitest run sales-session/list → 22 passed (a rep outside the tree is left out; truncated false)
npx vitest run calibration usage → 19 passed
npx tsc --noEmit → clean
```

## Findings

### F1 - the session list ignored the reporting tree
class: a service-role read without the tree check.
sweep: invariant 43 checks hides on service-role call reads; nothing checks the tree on them.
severity: high (no company uses the tree with more than one manager yet)

### F2 - session list, calibration, usage capped before filtering
class: limit before filter.
sweep: the six from the earlier sweep — all handled or recorded.
severity: medium
