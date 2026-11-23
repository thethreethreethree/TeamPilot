# CHECK - Forecast what-if

## Commands

```
npx vitest run dealRisk.test.ts RemotePipeline.render.test.tsx → 19 passed (copy only, originals unchanged; moving a deal into the past shows it as Past due; no POST; back restores)
```

## Findings

No findings: the what-if is a copy fed to the existing calculation; the test proves no request is made.

## Final

```
npm run check → first: ✗ theme:audit (text-amber-200 too pale in light mode) → amber-700/300 → ✗ tbc:manifest (§2.2 reason) → fixed → exit 0 · Test Files 900 passed | 1 skipped · Tests 6648 passed | 15 skipped
```
