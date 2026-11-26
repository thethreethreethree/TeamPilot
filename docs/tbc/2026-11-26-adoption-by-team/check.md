# CHECK - Message adoption by team

## Commands

```
npx vitest run adoption-board → 4 passed (per-team rates; only tree-allowed teams; reps 403)
npx vitest run AdoptionBoard.team KeywordTrackers → 6 passed (grid with said/calls; no switch for reps)
node scripts/invariant-audit.mjs → Violations: 0; npx tsc --noEmit → clean
```

## Findings

### F1 - nested teams could be read as additive
class: overlapping groups shown side by side.
sweep: the grid's note.
severity: low
