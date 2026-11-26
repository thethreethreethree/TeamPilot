# CHECK - The bell tells you when a followed search has new calls

## Commands

```
npx vitest run NotificationBell.render → 35 passed (badge counts a followed search once; link names it; capped; null not shown; dropped on click)
npx vitest run remote-sales/search → 8 passed (?saved= marks a followed search seen and applies its filters; a non-followed one writes nothing)
npx tsc --noEmit → clean
```

## Findings

### F1 - a notice from a stored row would re-derive access
class: a service-role job judging RLS's rules (reviews 3 and 4).
sweep: the bell derives it through the person's own client instead.
severity: low (avoided by design)

### F2 - the search page couldn't tell a link was a saved search
class: a link that leaves its state behind.
sweep: saved=<id> handled; unknown keys are still ignored by fromQuery.
severity: low
