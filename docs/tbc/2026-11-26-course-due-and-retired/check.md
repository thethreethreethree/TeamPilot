# CHECK - Course due dates and retired scenarios

## Commands

```
npm run db:verify → 0358 ok; npm run db:apply → verify:live passed
node scripts/invariant-audit.mjs → 0 (the new mfa rule passes 0358); node scripts/rls-audit.mjs → passed
npx vitest run coursePractice courses course-assignments Courses.render → passed
npx tsc --noEmit → clean
npm run check → gates the commit
```

## Findings

### F1 - a course's due date couldn't move
class: missing write (residual).
sweep: course assignments.
severity: low

### F2 - a retired scenario still assigned through a course
class: a rule enforced on one path and not another.
sweep: every place course practice is assigned (assign, edit) — both go through assignPractice.
severity: low
