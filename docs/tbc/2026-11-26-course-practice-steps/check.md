# CHECK - Practice steps in training courses

## Commands

```
npm run db:verify → 0357 ok; constraints before: body_check, kind_check present; npm run db:apply → verify:live passed; after: kind_shape, no body/kind checks
npx vitest run courses course-assignments Courses.render → 4 + 5 + 4 + 4 passed
node scripts/invariant-audit.mjs → Violations: 0 (allowlist reason for the courses route rewritten)
npx tsc --noEmit → clean
npm run check → gates the commit
```

## Findings

### F1 - a course couldn't include practice
class: missing feature (residual R1).
sweep: courses and course assignments.
severity: medium

### F2 - an edited course's new practice would be assigned by the editor, outside their tree
class: an authorization taken from the wrong person.
sweep: the one write that assigns on another manager's behalf.
severity: medium (caught before commit)
- npm run check, first run → 2 real failures: British 'practise' on two screens (americanSpelling) and the editor's scenario read treated a failure as empty (noFailedReadAsEmpty); both fixed (a failed read now says so)
- npm run check, second run → every step green; tests 971 files passed, 9 files never started (vitest 'Failed to start forks worker', load); those 9 rerun alone → 9 files / 62 tests passed
