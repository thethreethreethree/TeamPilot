# CHECK - Revenue Phase 6: the forecast board

## Commands

```
npm run db:verify → 0376 ok (rolled back)
probe p0376.mjs (production, rolled back, booleans/counts only):
  rep submits own → ok; for another → 42501; rep sets a target → 42501; 2026-Q5 → 23514
  rep sees own submissions; another plain member sees 0
npx vitest run src/app/api/coach/remote/forecast src/lib/coach/remote/revenue → 9 files passed (exit 0)
npx vitest run src/components/remote-sales/__tests__/RemotePipeline.render.test.tsx src/components/remote-sales/__tests__/ForecastBoard.render.test.tsx → 12 passed (exit 0)
tsc clean · theme / rls / invariant / reachability / writer audits ✓
npm run check → gates the commit
```

## Findings

### F1 - Gong's green / red accuracy colours break the brand
class: semantic colours outside the palette (BRAND.md: no red or green).
sweep: ForecastBoard (brand amber tones, each with a word).
severity: low; caught by the theme audit.

### F2 - the board crashed the whole Forecast view on a reply without submissions
class: a client that trusts a reply's shape.
sweep: ForecastBoard's load (a reply in any other shape is a failed read, said as one); a render test pins it.
severity: medium; found by RemotePipeline.render.test.tsx in the canonical check.
