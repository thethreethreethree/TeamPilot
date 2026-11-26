# CHECK - Filter Search and Team call stats by call category

## Commands

```
npx vitest run search team-stats TeamCallStats → 28 + 5 + passed
americanSpelling → passed; invariant-audit 0; theme clean; eslint clean; tsc clean
npm run check → gates the commit
```

## Findings

### F1 - categories couldn't filter anything
class: data with no reader.
sweep: Search and Team call stats (the two places F10.9/F12 ask for it).
severity: low
