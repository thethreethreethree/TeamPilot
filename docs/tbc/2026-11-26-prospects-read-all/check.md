# CHECK - The pipeline reads every prospect

## Commands

```
npx vitest run prospects → 3 passed (600 prospects returned; no limit; id last)
npx vitest run dealSentiment prospects routes calendar day askPipeline pipeline-link → passed
node scripts/invariant-audit.mjs → Violations: 0; npx tsc --noEmit → clean
production count: remote_prospects 0
```

## Findings

### F1 - the pipeline stopped at 500 prospects
class: a silent cap.
sweep: listProspects' six callers.
severity: medium (latent: 0 prospects on production)

### F2 - unchunked .in() over every prospect
class: a request URL that grows with the data.
sweep: to-do links, to-dos, deal sentiment links.
severity: low
