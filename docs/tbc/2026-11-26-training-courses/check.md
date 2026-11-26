# CHECK - Training courses (ordered lessons)

## Commands

```
npx vitest run courses course-assignments Courses.render → 3 + 4 + 3 + 3 passed
npm run db:verify → 0355 ok; npm run db:apply → applied; verify:live FAILED (mfa_required missing on 4 tables)
0356 → db:verify ok; db:apply → verify:live passed
node scripts/invariant-audit.mjs → 0 (new mfa rule: 4 violations with 0356 moved aside, 0 with it)
npx tsc --noEmit → clean; eslint on the new files → clean
npm run check → gates the commit (&&)
```

## Findings

### F1 - no place for lessons
class: a missing feature (ledger F17.1).
sweep: Remote Sales → Training.
severity: medium

### F2 - new tables without the MFA policy reached production
class: a database rule checked only after the apply.
sweep: every table created after 0309 (the new static rule); none other found.
severity: medium (the tables were empty; fixed within minutes by 0356)
- npm run check, first run → EXIT 1 (rls-audit: the four tables' write paths undocumented); entries added to scripts/rls-audit.mjs; rerun gates the commit
- npm run check, second run → every step green except 2 test timeouts (915 s each; load average 10) in RecordingConsent.render and RemotePipeline.render, untouched by this build; rerun alone → 20/20 passed
