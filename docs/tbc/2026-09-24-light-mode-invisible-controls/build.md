# BUILD — three controls that were invisible on cream

Every token below was chosen by reading what the CSS variable resolves to in **both** modes
(`globals.css` lines 74/76/110/112), then re-rendering to confirm — including re-checking that dark
did not change, because a fix that silently redesigns the mode people already use is not a fix.

### The pager's inactive dot

- **write-path:** `bg-ink-500` in `src/components/sales-coach/doorlog/MobileHomePager.tsx`.
- **read-path:** `npm run visual -- macroHome`, light capture — two dots where there had been one.

Was `bg-white/20`. `ink-500` is #71717A: legible on near-black AND on cream, which is precisely the
property white-at-20% lacks. Mode-agnostic by construction rather than by luck.

This one matters more than a dot. The pager's other page held the only way out of Macro Mode until
an hour earlier, so in light mode a rep saw no second page AND no exit.

### The Macro Mode switch track

- **write-path:** `bg-ink-300 dark:bg-ink-700` in
  `src/components/sales-coach/doorlog/MacroModeToggle.tsx`.
- **read-path:** `npm run visual -- salesCoachHome`, both captures — a pill track with a knob on
  cream, and a dark-grey track on black.

Was `bg-white/15`, which on cream rendered the switch as a bare white knob floating with no track.
Not a cosmetic issue: a control you cannot identify as a control, showing a state you cannot read.

`ink-300` on light / `ink-700` on dark rather than a single value, so **dark lands close to what
white/15 looked like** and the appearance a rep already knows is unchanged.

### The home's cards and chips

- **write-path:** `border-default` and `bg-surface` replacing `border-white/10`,
  `bg-white/[0.02]` and `bg-black/30` in `src/app/dashboard/sales-coach/page.tsx`.
- **read-path:** `npm run visual -- salesCoachHome`, light capture — the Macro Mode block and both
  stat chips are bordered cards again.

`--border-default` is #27272A dark / #E4E4E7 light; `bg-surface` gives a card that reads as a card
on either ground. Before, in light, the page's structure dissolved: the Macro card and the
PITCHES/ROLEPLAYS chips rendered as floating text with no boundary.

`bg-black/30` on the input wells went too — a near-black well is invisible ON black and wrong on
cream, so it was failing in both directions.

**Deliberately NOT changed:** `border-ember-400/40` (ember is mode-agnostic per docs/BRAND.md) and
anything on `bg-brand-shell`, which is fixed dark by design. "Fixing" those would be the opposite
mistake.

### The harness that found them

- **write-path:** `scripts/visual/shoot.mjs`, `vitest.visual.config.ts`, `src/test/visual.ts`, and
  two capture files under `src/test/captures/`.
- **read-path:** `npm run visual` — compiles the project's real Tailwind bundle, renders each
  capture under jsdom, and screenshots it in both themes:

```
$ npm run visual
      Tests  1 passed (1)
  2 image(s) in artifacts/visual/
exit 0
```

Deliberately **not** in `npm run check`: captures are `*.capture.tsx`, which matches nothing in
`vitest.config.ts`'s include patterns. No baselines, no diffing, nothing fails. Font rendering
differs between machines and a pixel gate would produce failures that are not real — the flake
generator `vitest.config.ts`'s own timeout comment warns about.

Two details that are load-bearing rather than decorative:

- **`width` is mandatory** on `capture()`. A subtree lifted out of its parent flex chain has no
  width constraint, and a row that fits a phone renders as clipped. That happened on the very
  first capture and looked exactly like a real defect. The shooter builds a container of the
  declared width and makes the screenshot window 40px wider, so a genuine overflow shows AS
  overflow instead of being cropped by the window.
- **The frame sets `flex` and `min-height` on the child, never `display`.** Forcing the child to
  flex would break any grid-based surface — a different way of inventing layout bugs.

Missing Chrome exits 1 with the paths it looked in. A run that says nothing and exits 0 would read
as "the surfaces are fine", which is the silence this whole tool exists to break.
