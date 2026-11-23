# CHECK - What changed in the pipeline this week

## Commands

```
npx vitest run pipelineChanges.test.ts → 2 passed (creation events aren't changes; won/lost carry the amount then; amount and close-date moves; outside-period events ignored)
npx vitest run prospects/changes route → 2 passed (named changes; bad period 400; failed reads 500)
npx vitest run RemotePipeline.render.test.tsx → 8 passed (the card lists the changes and the headline)
```

## Findings

### F1 - a reply without the changes list would have crashed the card
class: trusting a response's shape.
sweep: the card treats any reply without `changes` and `summary` as a failed load ("Couldn't load the changes").
severity: low

## Final

```
npm run check → exit 0 · Test Files 906 passed | 1 skipped · Tests 6681 passed | 15 skipped
```
