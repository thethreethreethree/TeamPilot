# CHECK - Turn off FYI bell notices

## Commands

```
node replay0334.mjs (PGlite 0001–0334) → mute call_scored / strong_session ACCEPTED · mute score_disputed / feedback_requested refused · after update/delete: 2 rows, still muted
npm run db:apply → applying 0334_notification_mutes.sql … ok
npx vitest run mutes + route + bell route + panel → first: 1 failed (the switch sent muted:false when turning a notice OFF) → fixed → 32 passed; panel test now drives both directions
```

## Findings

### F1 - the switch sent the opposite of what it showed
class: an inverted boolean between "on" (shown) and "muted" (stored).
sweep: the only other place the two meet is setMuted in the same handler (fixed together); the bell reads `muted` directly.
severity: high (caught before shipping)

### F2 - the badge would count notices the bell hides
class: two queries that must share one filter.
sweep: the bell's GET has exactly two notification queries; both use notMuted().
severity: medium

## Final

```
npm run check → exit 0 · Test Files 923 passed | 1 skipped · Tests 6764 passed | 15 skipped
```
