# CHECK - Team call stats

## Commands

```
npx vitest run teamStats.test.ts + team-stats route + TeamCallStats.render → 2 + 3 + 2 passed
```

## Findings

### F1 - a team average over reps would mis-weight
class: an average of averages.
sweep: the only other aggregate here (the rep's 30-day average on the call page) averages calls already.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 929 passed | 1 skipped · Tests 6781 passed | 15 skipped
```
