# CHECK - Course editor autosave

## Commands

```
npx vitest run CourseManager.autosave Courses.render → 8 passed
noFailedReadAsEmpty, americanSpelling → 7 passed; invariant-audit 0; eslint clean; tsc clean
npm run check → gates the commit
```

## Findings

### F1 - a half-written course was lost on reload
class: no draft kept.
sweep: the course editor.
severity: low
- npm run check, first run → 1 failure: CustomBriefs render again — a second ordering of the same race (the read's effect started after the click); fixed by bumping the counter when the run's answers arrive, with a test for that order
