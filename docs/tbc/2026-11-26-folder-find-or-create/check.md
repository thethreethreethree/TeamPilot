# CHECK - Folder path levels found or made in one statement

## Commands

```
npm run db:verify → 0365 ok; npm run db:apply → verify:live passed
production Postgres, rolled back → 3/3 (case-insensitive reuse; parents kept apart; exactly 3 made)
npx vitest run library → 20 passed
npm run check → gates the commit
```

## Findings

### F1 - a folder could be made twice by concurrent saves
class: find-then-create across requests.
sweep: the one path-save loop.
severity: low
- npm run check, first run → 1 failure: CustomBriefs render (a stored-answers read finishing after a run overwrote the run's answers — a real race, not load); fixed with a run counter and a test; rerun gates the commit
