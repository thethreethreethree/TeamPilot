# CHECK - Pipeline value trend and stage funnel

## Commands

```
npx vitest run pipelineChanges.test.ts → 4 passed (open value as of each instant, a mid-period win drops out after it; funnel by stage, spelling-insensitive)
npx vitest run prospects/changes route → 3 passed (weeks=3 → three week ends, oldest first)
npx vitest run RemotePipeline.render.test.tsx → 8 passed (strip headline $500 → $1,500; funnel shown)
```

## Findings

No findings: the trend replays the same events as the changes card; the funnel counts prospects already loaded.

## Final

```
npm run check → exit 0 · Test Files 906 passed | 1 skipped · Tests 6684 passed | 15 skipped
```
