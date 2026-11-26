# CHECK - Lesson content: a library call and an outside link

## Commands

```
npm run db:verify → 0359 ok; npm run db:apply → verify:live passed
npx vitest run library courses course-assignments Courses.render → 26 passed
npx vitest run noFailedReadAsEmpty americanSpelling → 7 passed; theme:audit → clean
node scripts/invariant-audit.mjs → 0 (courses route on the hide allowlist, with why)
npx tsc --noEmit → clean; eslint → clean
npm run check → gates the commit
```

## Findings

### F1 - lessons were text only
class: missing feature (F17.2).
sweep: course steps.
severity: medium

### F2 - the library page could show the other tab's calls after a fast switch
class: an older async answer written last.
sweep: the library page's one loader.
severity: low
