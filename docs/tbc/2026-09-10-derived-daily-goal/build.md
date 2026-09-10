# BUILD - the daily sales goal decides itself

### The rule
- write-path: `src/lib/coach/doorlog/deriveGoal.ts` - `deriveDailySalesGoal({sold, presentations, doors,
  activeDays})` returns a goal AND the basis it came from. Ceiling of 10 so a freak window cannot ask a
  person for forty sales; floor of 1 because a goal of zero is not a goal; rounded UP because rounding
  1.4 down quietly lowers a rep's day.
- read-path: a rep with no manager row opens the app to real dials and a real door number instead of a
  panel telling them to ask somebody.

### Wiring it where the goal is read
- write-path: `src/lib/coach/doorlog/dayTargetData.ts` - the 30-day counts move ABOVE the goal check,
  because the goal is derived from them; one added query counts DISTINCT working days. A manager's row
  still wins. `DayTargetView` gains `goalBasis`.
- read-path: `GET /api/coach/doorlog/day-target` returns the view whole, so the app receives the basis
  with no route change and an older app simply ignores it.

### Telling the rep where the number came from
- write-path: `goalBasisSentence` here, and `goalBasisLine` in the native app, so each speaks in its own
  voice rather than the server posting copy into a screen.
- read-path: one quiet line under the target card. A server that does not say gets no line, never an
  invented reason.

### The gate (A30)
- write-path: `__tests__/deriveGoal.test.ts` (9) pins the three bases, the working-day divisor, the
  round-up, the floor, the ceiling and the nonsense-input behaviour;
  `__tests__/dayTargetData.test.ts` has two tests REWRITTEN - one asserted "no manager goal -> empty
  state", which is the behaviour that was asked to change, and a new one pins that a manager's row still
  wins.
- read-path: a regression that returns 0, or that divides by the window instead of working days, or that
  lets the derivation override a manager, fails a named test.
- gate-or-promise: `npx vitest run src/lib/coach/doorlog` - 101 tests, and the two rewritten ones are the
  ones that would have gone quietly green under the old behaviour.

## Files
- `src/lib/coach/doorlog/deriveGoal.ts` (new)
- `src/lib/coach/doorlog/__tests__/deriveGoal.test.ts` (new)
- `src/lib/coach/doorlog/dayTargetData.ts`
- `src/lib/coach/doorlog/__tests__/dayTargetData.test.ts`

## Ripple (1.5)
- No schema change, no policy change, no new dependency. `rep_daily_sales_goal` stays manager-write.
- The frozen path is untouched: a target frozen for today still never recomputes, so a rep's number
  cannot move under them mid-day. The freeze stores the effective goal.
- EMPTY_NO_GOAL is DELETED. It served the case "no manager set a goal", which is now derived, so nothing
  reaches it - the linter said so, which is the honest signal that a branch is gone rather than rare. The
  app's no-goal panel is still reachable via the route's 503 before migration 0247.
- One extra query per first-open-of-day, on a table already being read three times.
