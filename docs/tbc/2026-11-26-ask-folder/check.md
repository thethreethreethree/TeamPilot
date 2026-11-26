# CHECK - Ask the coach about a library folder

## Commands

```
npx vitest run remote-sales/library → 3 passed (offered and sent with the folder's calls; not offered when a call can't be opened)
npx tsc --noEmit → clean
```

## Findings

### F1 - a folder you can hear but not open
class: an action offered over items the viewer can't open.
sweep: offered only when every item canOpenCall.
severity: low
