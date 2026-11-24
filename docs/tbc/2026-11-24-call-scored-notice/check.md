# CHECK - Tell the rep their call is scored

## Commands

```
node replay0332.mjs (PGlite 0001–0332) → call_scored: ACCEPTED · call_ready still: ACCEPTED · made-up: refused (known local failures 0315/0327)
npm run db:apply → applying 0332_notify_call_scored.sql … ok
npx vitest run scoreSession.test.ts + NotificationBell.render → 54 passed
```

## Findings

### F1 - the "ready" notice fires before the score exists
class: a notice placed in a step that runs before the event it implies ("ready: transcript, review and score").
sweep: call_ready's text promises a score that may not be stored yet; the new notice is the one that confirms it.
severity: low

## Final

```
npm run check → exit 0 · Test Files 917 passed | 1 skipped · Tests 6737 passed | 15 skipped
```
