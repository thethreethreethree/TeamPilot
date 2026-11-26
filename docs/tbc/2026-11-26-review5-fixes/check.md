# CHECK - Acting on the fifth review

## Commands

```
npx vitest run SalesCoachShell.bell.render → 3 passed (one bell on desktop, phone, and collapsed)
npx vitest run components/sales-coach components/remote-sales remote-sales/search trackers → 705 + 29 passed
npx tsc --noEmit → clean; eslint on the changed files → clean
```

## Findings

### F1 - two bells mounted, one deaf to Realtime
class: CSS-hidden components still mount; a shared client returns a channel by name.
sweep: every NotificationBell mount (both shells); the Remote Sales shell has one.
severity: medium

### F2 - same-page bell link didn't apply or mark seen
class: a mount-only effect reading the URL.
sweep: the Search page is the only page that takes a saved search from the URL.
severity: medium

### F3 - phone bell covered the KPI period switch
class: a floating control over page content.
sweep: removed; the bell is in the tab bar.
severity: low

### F4 - second Go live answered 409
class: a check ordered before the state it depends on.
sweep: publish only.
severity: low
