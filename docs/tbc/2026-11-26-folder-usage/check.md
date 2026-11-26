# CHECK - Folder usage

## Commands

```
npx vitest run remote/library remote-sales/library → 21 + 1 passed (rep excluded, repeats once, peer sees no count)
npx tsc --noEmit → clean
```

## Findings

### F1 - a failed usage read could show 0
class: error-as-no-data.
sweep: counts are null on a failed read.
severity: low
