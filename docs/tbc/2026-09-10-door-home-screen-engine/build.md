# BUILD — door home screen, Phase 05: the day-target engine

### The pure engine
- write-path: `src/lib/coach/doorlog/dayTarget.ts` — `calculateDayTarget(input)→{doorsTarget,
  presentationsTarget, soldTarget, usedStarter}` works a manager-set daily sales goal back through the two
  30-day ratios; `dialFill(count,target)` gives the clamped ring fraction. No DB, no imports of app state.
- read-path: the Phase-04 read layer (next increment) will fetch the goal + compute the ratios from
  `door_knocks`/`pitches` and call this; the Phase-07 dials will call `dialFill`. No caller yet, by design.

### The starter fallback (never divide by zero)
- write-path: an unqualified rep, or a null/zero/absurd ratio, uses `STARTER_CLOSE_RATIO=1/9` +
  `STARTER_CONTACT_RATIO=1/4.4` and sets `usedStarter`. A non-positive goal returns all zeros.
- read-path: the screen shows the starter target for new reps and the empty state for no-goal — no crash, no
  `goal ÷ 0 = Infinity`, no fabricated number.

### Round up + clamp
- write-path: `ceilPos` rounds every step up (79.2 doors → 80); the door number is clamped to
  `[DOORS_FLOOR=20, DOORS_CEILING=200]`; `dialFill` clamps overshoot at 1.
- read-path: a target that can't reach the goal (round-down) or a useless 4/900-door target never reaches the
  rep; 95 of 80 fills the ring and stops.

### The gate (A30)
- write-path: `src/lib/coach/doorlog/__tests__/dayTarget.test.ts` — 10 tests: the worked example (80, not 79),
  the starter fallback, zero-sales, zero-doors, floor, ceiling, no-goal, and the three `dialFill` cases.
- read-path: reverting round-up to round-down fails the worked-example test (mutation-proven in check.md).

## Files
- `src/lib/coach/doorlog/dayTarget.ts`
- `src/lib/coach/doorlog/__tests__/dayTarget.test.ts`

## Ripple (§1.5)
- Pure module; nothing imports it yet, so it cannot affect the live app until a later phase wires it.
- The ratios it consumes come from existing `door_knocks`/`pitches` (INSPECTION.md Q2) — no new activity table.
