# CHECK - Coaching by: everyone, theirs, or yours

## Commands

```
npx vitest run CoachingInbox → 13 passed (Everyone / Rae Lead / You rows; not offered on your own team)
npx tsc --noEmit → clean; eslint CoachingInbox.tsx → clean
```

## Findings

### F1 - a filter that outlived its team
class: state kept across a context change.
sweep: reset on team change.
severity: low
