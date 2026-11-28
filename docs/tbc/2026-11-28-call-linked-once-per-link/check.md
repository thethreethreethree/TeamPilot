# CHECK - once per link

## Commands

```
npx vitest run engage/, generateSessionArtifacts.test, market routes → 59 passed (waits, runs once on landing, no repeat on v2)
npm run check → gates the commit
```

## Findings

No findings left open beyond the residuals in closure.md. Fixed from the review: repeat side effects per transcript version; old-format keys; silent version and label read failures. Confirmed sound: enrolment state, battlecard copy and labels, link and processing at the same version deduped, the hide scan before the hook.
