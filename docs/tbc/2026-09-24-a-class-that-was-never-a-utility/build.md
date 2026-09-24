# BUILD — the producer was the Tailwind config

### `stroke-primary` and `fill-primary` are not utilities

- **write-path:** `tailwind.config.ts` — `stroke` and `fill` sections added under `theme.extend`,
  mirroring the existing `textColor` token set.
- **read-path:** the `scoreboard` pair, cropped to the progress card.

`primary`, `secondary`, `muted` and `brand` were defined under **`textColor` only**. `primary` is
not in Tailwind's default palette, so `stroke-primary` matches no utility, Tailwind emits no CSS
for it, and the class name survives into the DOM doing nothing. The element then renders with
SVG's own defaults: **no stroke, and `fill: black`.**

So `MyProgress`'s trend line was invisible, and its "emphasized last point" was black — in dark
mode as well as light. It type-checks. It lints. It reads correctly. It has never drawn a line.

**The sweep is exhaustive and the class is two.** Across every file Tailwind scans
(`src/{pages,components,app}/**/*.{js,ts,jsx,tsx,mdx}`), `(stroke|fill)-(primary|secondary|muted|
brand|default|strong)` appears only in `MyProgress.tsx`. Every other `stroke-*`/`fill-*` in the
codebase names a real palette colour — `ember-400`, `ink-300`, `white`.

That same sweep is what makes the config change safe to ship without re-shooting every capture:
the edit is purely additive, so the only files whose rendering can change are the files using the
new utilities, and there is one.

### The dot that was a lozenge

- **write-path:** the `<circle r={1.8}>` replaced by a zero-length `<line>` with
  `strokeLinecap="round"`, `strokeWidth={5}` and `vectorEffect="non-scaling-stroke"`.
- **read-path:** the same crops.

The SVG is `viewBox="0 0 100 32"` with `preserveAspectRatio="none"` inside a `w-full h-12` box —
roughly 9:1 non-uniform scaling. The path carried `vectorEffect="non-scaling-stroke"` and survived
it; the circle did not, and r=1.8 became a flat lozenge about 31px wide and 5px tall. A round cap
with a non-scaling stroke is a dot of constant size in device pixels, which is what the docstring
means by "an emphasized last point".

### The gridlines and the chip

- **write-path:** both gridlines `stroke-white/10` → `stroke-ink-200 dark:stroke-white/10`, plus
  `vectorEffect` so their 0.5 width is not squashed by the same scaling;
  `Scoreboard.tsx:63` `solid: "bg-white/10 …"` → `bg-ink-200 dark:bg-white/10 …`;
  `MyProgress.tsx:76` `hover:bg-white/5` → `hover:bg-surface-raised`.
- **read-path:** the `scoreboard` pair, cropped to the bands table and to the chart.

The "Solid" chip is the one band of five with no pill on cream. It is also the most common band on
a real team — the middle of the distribution — so the row that renders differently from its
neighbours is the modal one.

```
$ npm run visual -- scoreboard
      Tests  1 passed (1)
  2 image(s) in artifacts/visual/
$ npx tsc --noEmit -p tsconfig.json → exit 0
```
