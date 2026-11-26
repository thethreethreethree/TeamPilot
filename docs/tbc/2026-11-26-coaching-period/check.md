# CHECK - A period for coaching metrics

## Commands

```
npx vitest run coaching-metrics → 8 passed (7-day period, 400 for 12, previous listened from the same rule)
npx vitest run CoachingInbox → 9 passed (period buttons refetch, heading follows the answer, CSV carries team + period, new arrows)
npx tsc --noEmit → clean
```

## Findings

### F1 - Download CSV ignored the team picker
class: a control that drops state the screen shows.
sweep: the inbox and metrics fetches already carried the team; only the link did not.
severity: medium

### F2 - listen and request reads not paged
class: silent 1000-row cap.
sweep: the session read was already paged; the events read goes through loadCoachingEvents (paged).
severity: medium

### F3 - string comparison of timestamps
class: format mismatch between the database and toISOString.
sweep: the new period split parses both sides.
severity: low
