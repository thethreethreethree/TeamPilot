# CHECK - A manager can mark a rubric item "Doesn't apply"

## Commands

```
node replay0331.mjs (PGlite 0001–0331) → na at 0 points: ACCEPTED · na with points: refused · made-up grade: refused · hit still fine: ACCEPTED (known local failures 0315/0327)
npm run db:apply → applying 0331_rubric_item_na.sql … ok · DB now at 0331
npx tsc --noEmit → every grade map missing "na" found (PitchDetail, askCoach, keyMoments, readRecordings) → handled
npx vitest run pitchScore + DisputeQueue + pitch-score routes + patterns + recordings → first: readPatterns fakes have no .neq → loop filter only → 740 passed
npx vitest run readApplicableGrades.na → 1 passed
```

## Findings

### F1 - the aggregate counted any grade that wasn't hit or partial as a miss
class: a reader with an else-branch that absorbs a new stored value.
sweep: every reader of pitch_score_elements.grade (11 files) — aggregate (fixed), patterns (fixed), repNeeds and search (already explicit), keyMoments/milestones (compare to one value).
severity: high (an N/A would have read as a miss in team rates)

### F2 - marking a whole section N/A would leave nothing to score it out of
class: a scaling divisor that can reach zero.
sweep: the only divisor added is the section's applicable maximum.
severity: medium

### F3 - an earlier residual called patterns' in-person-only rule a gap
class: a recorded decision mistaken for an omission.
sweep: OPEN.md entry corrected (appended), with the decision's commit.
severity: low

## Final

```
npm run check → exit 0 · Test Files 916 passed | 1 skipped · Tests 6730 passed | 15 skipped
```
