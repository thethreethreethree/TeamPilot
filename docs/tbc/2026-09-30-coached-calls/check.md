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
