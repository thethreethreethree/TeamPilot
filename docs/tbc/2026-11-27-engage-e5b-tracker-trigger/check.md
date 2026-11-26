# CHECK - Engage E5b: the tracker trigger

## Commands

```
npm run db:verify → 0380 ok (rolled back)
npx vitest run src/lib/coach/remote/engage → passed (exit 0)
npx vitest run trackerScan smartTrackerScan generateSessionArtifacts → 19 passed (exit 0)
tsc clean
npm run check → gates the commit
```

## Findings

### F1 - an agent failure would have failed the tracker scan
class: a side effect inside a pipeline step that can throw.
sweep: both scanners call fireTrackerAgents, which never throws.
severity: high (hits would not be reported as stored); found by the scanner tests.
