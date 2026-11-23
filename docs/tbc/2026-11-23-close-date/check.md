# CHECK - Expected close date and the forecast by month

## Commands

```
npx vitest run dealRisk.test.ts askPipeline.test.ts macroMode.test.ts RemotePipeline*.render → all passed (dealRisk 11, macroMode 15, pipeline renders 8)
node scratchpad/replay0320.mjs (PGlite, every migration then 0320 again) → failures: 1 (0315 local only, known) · refused: words · refused: number · current close_date 2027-01-15 (latest wins) · cleared: null · other kinds still accepted
npm run db:apply → applied 0320 · DB now at 0320 · ✅ ALL 33 invariants hold
production: kind CHECK includes 'close_date'; remote_prospects_current answers close_date (0 prospects in production yet)
```

## Findings

### F1 - the Ask box would not have known a deal's expected close date
class: a new prospect fact read by one consumer and not the others.
sweep: consumers of ProspectRow — askPipeline (now includes it), dealRisk/forecast (now uses it), RemotePipeline (shows
it). Routes that read remote_prospects_current with select("*") pick the column up unchanged.
severity: low

## Final

```
npm run check → exit 0 · Test Files 891 passed | 1 skipped · Tests 6605 passed | 15 skipped
```
