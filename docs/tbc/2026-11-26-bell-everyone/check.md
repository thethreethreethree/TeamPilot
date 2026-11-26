# CHECK - The bell is everyone's

## Commands

```
npx vitest run src/components/sales-coach src/components/remote-sales → 662 passed
npx vitest run RemoteSalesShell.bell.render bellMounted → 3 passed (a rep has the bell; no manager-gated mount; both shells mount it)
npx tsc --noEmit → clean; eslint on the four files → clean
probe_bell.mjs (production, counts) → 0 notifications exist yet
```

## Findings

### F1 - every rep-addressed notice was unreachable
class: a surface whose audience widened while its mount didn't.
sweep: grep for every `<NotificationBell` mount and every reader of manager_notifications — one of each.
severity: high (no one has missed one yet: production holds 0 notices)

### F2 - managers saw their notices on one page only
class: same.
sweep: same.
severity: medium
