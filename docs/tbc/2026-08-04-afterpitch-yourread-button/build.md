# BUILD — After-Pitch "Your read" prominent button

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### CollapseToggle — opt-in `prominent` variant + "Your read" adoption
`src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx`.

- **write-path:** `CollapseToggle` gains a `prominent?: boolean` prop. When true it renders a bold amber button
  (Lightbulb icon + `text-base font-bold` title + a `Tap to open` / `Hide` hint + chevron + amber border/fill/
  glow) instead of the quiet default row. The "Your read" toggle (the `Narrative` header) now passes
  `prominent`. Nothing else about the section is written/changed.
- **read-path:** the button reads the same `open` state and calls the same `onToggle`; the section still reads
  `narrative.hasSignal` (omits when false) and `defaultOpen` (Standard auto-opens, Expert collapses). Other
  `CollapseToggle` callers (e.g. "Score Assessment Review") pass no `prominent` → render unchanged.

## Files
- `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx`
