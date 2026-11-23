# CHECK - A time on the next call

## Commands

```
npx vitest run macroMode ics calendar (lib + route) remote-sales render tests → 104 passed
npx vitest run RemotePipeline.nextCallTime.render → 1 passed (row shows 3:30; time change sends the date; date change keeps the time)
node scratchpad/replay0325.mjs (PGlite, every migration then 0325) → timed: next_call_time 15:30 · refused: 3pm · refused: 25:00 · new date without time → next_call_time null
npm run db:apply → applied 0325 · DB now at 0325 · npm run verify:live → ALL 33 invariants hold
```

## Findings

### F1 - changing the date on the card would have dropped the time
class: one fact edited through two inputs.
sweep: the card's two inputs now each send both values; the call screen sets a new date only (a new booking, which
clears the time on purpose).
severity: low

## Final

```
npm run check → exit 0 · Test Files 900 passed | 1 skipped · Tests 6645 passed | 15 skipped
```
