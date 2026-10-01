# CHECK - "scored" means the rubric

## Change

"scored call(s)" becomes "coached call(s)" in the coaching grade's count and its provisional line
(AgentGradeBadge, AgentEloBadge), and in the analytics skills empty state, which counts the same coach grading.

## Commands

```
$ npx vitest run src/components/sales-coach/__tests__/scoredMeansRubric.test.ts
      Tests  4 passed (4)
exit 0

$ (mutation: AgentGradeBadge.tsx restored to "scored call", test re-run, change restored)
      Tests  2 failed | 2 passed (4)
exit 1
```

## Findings

### Two counts of different things shared the word "scored"

class: one word naming two different measures on the same surface
sweep: grep -rnE "scored (call|session|pitch)" src --include=*.tsx --include=*.ts
severity: medium

Fixed for the grade's count, as the founder decided.

### The gamification surfaces also say "scored pitches" for points

class: one word naming two different measures on the same surface
sweep: grep -rn "scored pitch" src/lib/coach/gamification src/components/sales-coach/Scoreboard.tsx src/lib/coach/pitchScore/milestones.ts
severity: low

`weeklyDigest.ts:318` says "N scored pitches this week" and `Scoreboard.tsx:175` says "No scored sessions",
both counting gamification sessions. `milestones.ts:67` says "Century: 100 scored pitches", counting rubric
scores. Not changed: the founder's decision covered the grade's count. Surfaced to the founder.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended — the full gate

```
$ npm run check
      Tests  5579 passed | 15 skipped (5594)
CHECK_EXIT=0
```

## Appended 2026-09-30 — the points surfaces follow (founder, second picker)

The founder chose "Yes, say 'coached' there too" for the residual below. `weeklyDigest.ts` (the empty row, the
plain-text line, and the rep footer "N coached pitches this week") and `Scoreboard.tsx` (both empty states) now
say "coached". `scoredMeansRubric.test.ts` covers all five surfaces and rejects "scored call|pitch|session".

```
$ npx vitest run src/components/sales-coach/__tests__/scoredMeansRubric.test.ts src/lib/coach/gamification
      Tests  87 passed (87)
exit 0

$ (mutation: the digest's "(no coached pitches this week)" put back to "scored", test re-run, restored)
      Tests  1 failed | 5 passed (6)
exit 1
```

"Scored pitches" now means rubric scores only: the Century badge ("100 scored pitches") keeps it.

```
$ npm run check      (after the points surfaces changed)
      Tests  5581 passed | 15 skipped (5596)
CHECK_EXIT=0
```

## Appended 2026-10-01 — the badges and the Arena, found by the website-vs-app parity run

The parity run (docs/mobile-parity/README.md) compared the points badges on both sides and found both still
saying "First session scored". Under the founder's decision ("scored" is the rubric's word; points surfaces
say "coached") the website now reads "First session coached" (gamification/milestones.ts) and the Arena's
empty state "No coached pitches yet" (RepArena.tsx). The rubric breakdown's "No pitches scored in this period
yet" (PitchBreakdown.tsx) is the rubric and keeps "scored". The guard covers both new files and now also the
reversed form ("pitches scored"); mutation: RepArena put back to "No pitches scored yet", 1 failed. The app
side shipped in app commit 5a67221d.

```
$ npm run check   (against postgres:16-alpine)   first attempt
 Test Files  725 failed (725)  — every file "Vitest failed to find the runner"; no test ran
CHECK_EXIT=1
$ npx vitest run                                  diagnosis: the same suite alone
 Test Files  724 passed | 1 skipped (725)
$ npm run check   (against postgres:16-alpine)   second attempt
      Tests  5599 passed | 15 skipped (5614)
  RLS probes:              1 run, 0 failed
CHECK_EXIT=0
```

The first attempt's failure was the test runner failing to start in every worker, not an assertion; it did
not reproduce. Recorded rather than dropped.
