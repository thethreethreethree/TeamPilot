# CHECK - Win and loss by what was said

## Commands

```
npx vitest run winLoss → 4 passed (byMention: top trackers, mentioned vs not, open deals out, no rate below 5)
npx vitest run prospects/mentions → 3 passed (names once per deal; failed hits read 500; bad rep 400)
npx vitest run RemotePipeline.render → 10 passed (the table; 4–1 · 80% vs 1–4 · 20%)
node scripts/invariant-audit.mjs → Violations: 0; npx tsc --noEmit → clean
```

## Findings

### F1 - a failed mentions read shown as "nothing said"
class: error-as-no-data.
sweep: the panel shows an alert; the route returns 500.
severity: low
