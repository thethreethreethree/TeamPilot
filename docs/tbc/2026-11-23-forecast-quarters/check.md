# CHECK - Forecast by quarter

## Commands

```
npx vitest run dealRisk.test.ts RemotePipeline.render.test.tsx → 17 passed (byQuarter sums; expected null stays null; the toggle shows quarters with past due kept)
```

## Findings

No findings: byQuarter only sums the month rows the table already showed.

## Final

```
npm run check → first: ✗ tbc:manifest (§3.1, §3.3 reasons too short) → given real reasons → exit 0 · Test Files 900 passed | 1 skipped · Tests 6646 passed | 15 skipped
```
