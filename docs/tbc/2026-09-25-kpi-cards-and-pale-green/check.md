# CHECK — /kpi, a manager's company view

## Commands

```
$ npm run visual -- salesCoachKpi   → 1 passed, 2 images, each opened and described
$ npm run check                      → CHECK_EXIT=0, 715 files, 5,530 passed, invariant violations 0
```

## Looked at, as found

**[OBSERVED] kpi.light** — the four Layer cards and the Team card had NO boundary on cream: headed
columns floating on the page. Roster rows had no dividers. Seven pieces of `text-emerald-300` (the
growth summary, the reliance verdict, HEADLINE, Layer 4 reliance, the team reliance line and cells)
were faint mint on white.

**[OBSERVED] kpi.dark** — the same cards present, mint legible. A light-only defect.

## A fixture error, caught before it became a finding

**[OBSERVED]** Percentages rendered "0.21%". `compute.ts:63` returns `round1(... * 100)` and the
formatter at `page.tsx:124` appends `%`, so the PAGE was right and my fixture (fractions) was wrong.
Fixture corrected with a comment naming the unit.

## Fixed

- 7 white-alpha sites → 0. Cards on the page ground → `bg-surface` + `border-default`; the quota row
  that sits ON the Team card → `bg-surface-raised`; roster → `divide-default`.
- 9 pale-for-dark text colours → `text-{emerald,amber}-700 dark:text-{…}-300`, the convention the
  codebase already uses (57 + 69 existing). `:669` and `:825` were already split and left alone.

## Looked at, after

**[OBSERVED] kpi.light** — four bordered white cards, the Team card bounded, the quota row a raised
strip on it, roster dividers present, the greens deep and readable. **[OBSERVED] kpi.dark** — cards a
shade above the page (clearer than before), quota row one step above its card, dividers now visible,
mint unchanged.

## Correction to a count

The "27 across 11 files" reported earlier used a pattern matching only `-white/[0.0x]`. With
`white/5` / `white/10` included, Sales Coach is at **37 across 16 files** after this fix, and the
largest is `SalesCoachShell.tsx` (9), which the narrower pattern never showed.

## Not opened

No image, icon, logo, favicon or graphic asset was touched. Two captures generated and opened.
