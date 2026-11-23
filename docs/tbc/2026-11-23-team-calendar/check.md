# CHECK - Team call calendar

## Commands

```
npx vitest run src/lib/coach/remote/__tests__/calendar.test.ts src/app/api/coach/remote/calendar → 8 passed, exit 0
mutation: localDay with the offset sign flipped → 2 failed | 2 passed (calendar.test.ts); restored
npx tsc --noEmit -p . → exit 0
```

## Findings

### F1 - the Ask box opened closed prospects on a tab that wasn't showing
class: "open X" implemented as a URL change that only works when X is in the current filtered list (just shipped in
b9817f55).
sweep: `grep -n "onOpen={\|onOpenProspect={\|open(" src/components/remote-sales/RemotePipeline.tsx` → the Ask box and
the calendar are the only callers from outside the list; both now use goTo (sets the tab and the List view first).
severity: medium

### F2 - a calls-week read could be cut at 500 sessions
class: a bounded read whose cap is not shown.
sweep: `grep -n "limit(500)" src/app/api/coach/remote/calendar/route.ts` → one; 500 remote calls in one week for the
caller's scope.
severity: low
