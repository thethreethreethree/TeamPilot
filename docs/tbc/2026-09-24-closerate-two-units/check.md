# CHECK

## Commands

The first run of the gate **failed**, and it is the reason this file exists in its current form:

```
$ npm run check
src/lib/coach/assessment/__tests__/readTeamAssessment.test.ts(161,55): error TS2353:
  Object literal may only specify known properties, and 'outcome' does not exist in
  type 'Partial<Pitch> & { id: string; }'.
CHECK_EXIT=2
```

The test I had just written passed under vitest and did not typecheck. After correcting the
fixture:

```
$ npm run check
      Tests  5511 passed | 15 skipped (5526)
CHECK_EXIT=0
```

```
$ npx vitest run src/lib/coach/assessment/__tests__/readTeamAssessment.test.ts
      Tests  11 passed (11)
exit 0
```

## Mutant, restored

| Mutation | Result |
|---|---|
| Remove the conversion at `readTeamAssessment.ts:196` | `gives reps a PERCENTAGE and the team a RATIO for the same 1-of-3 close` fails by name. |

Run twice: once against the broken fixture (where it also failed, for the wrong reason) and once
against the corrected one. Only the second proves anything.

## Findings

### One payload carries `closeRate` in two units

class: a single field name carrying different units on one response, with the conversion applied in one branch and not the other
sweep: `grep -rn "closeRate" src --include=*.ts --include=*.tsx | grep -v __tests__` — 19 references across 10 files
severity: medium

**[OBSERVED]** `readTeamAssessment.ts:196` converts for `reps[]` (`* 1000 / 10`) and not for
`team.kpis` or `detail[].kpis`.

**[OBSERVED]** the board renders `reps[i].closeRate` raw with `%` (line 543) and the other two
through `pct()` (lines 347, 628), which multiplies by 100. All three are correct today.

**[INFERRED]** the next consumer has no signal telling it which it holds, beyond the comments added
here. The failure mode is silent and 100x.

**Nothing on screen is wrong.** This is a trap for the next change, and saying so precisely is the
difference between a finding and an alarm — particularly on the day of an investor demo.

### My own test passed while measuring nothing, twice

class: a test whose fixture does not produce what its assertions claim to measure
sweep: not a codebase sweep — a count of my own work today: four
severity: medium

**[OBSERVED]** four this session: a RepArena test whose negative assertions passed against a
render crash; an early `return` that skipped silently; this one's `outcome` property that vitest
accepted and `tsc` rejected; and Recordings mutants I had to probe by name before trusting.

Every one had the shape of the bugs being hunted: correct-looking, and about nothing. The
separator each time was a step *other* than the unit test — a positive assertion, a typecheck, a
mutation.

## What this does not prove

**The rename is untested because it was not made.** The guard protects the current arrangement; it
does not protect against someone reading `closeRate` at a NEW call site and guessing. Only the name
does that.

**Nothing ran against a real database.** The units claim rests on reading the producer, not on
observing a real row.
