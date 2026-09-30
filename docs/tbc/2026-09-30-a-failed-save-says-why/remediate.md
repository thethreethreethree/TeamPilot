# REMEDIATE

### Two causes of a failed save shared one bare null

gate-or-promise: gate

`storePitchScore` returns a typed cause; `scoreSession.test.ts` fails if `no_evidence` is merged back into
`store_failed` (mutation M4: caught).

### A drain kept paying to grade what it could not save

gate-or-promise: gate

The backfill route halts on two consecutive database refusals. The tests fail if the threshold is removed (M2:
99, caught), if it is lowered to one (M3, caught), or if a success stops resetting the run (M5, caught).

### Refusal labels dangled on a preposition

gate-or-promise: gate

`REFUSAL_LABEL` is `Record<ScoreRefusal, string>`, so a new refusal without a label does not compile. The
render test fails on any label ending in "for/of/to/with" or starting with "the" (M1: caught).
