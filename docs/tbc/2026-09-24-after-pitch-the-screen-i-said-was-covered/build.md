# BUILD — ten sites, thirteen tints, two branches

### Seven container cards

- **write-path:** `border border-white/[0.07] bg-white/[0.02]` → `border border-default bg-surface`,
  seven occurrences in `[id]/after-pitch/page.tsx`.
- **read-path:** `npm run visual -- afterPitch`, both themes.

The same recipe as the deck kit, written by hand in this file rather than imported. In dark they
were the outer containers for "Your scores", "What the coach cued" and "How did it go?"; on cream
those three sections had no edges and their contents floated.

### The timeline

- **write-path:** the connecting track `bg-white/12` → `bg-ink-200 dark:bg-white/12` (two sites,
  left and right of each node); the non-breakdown nodes `bg-white/25` → `bg-ink-400
  dark:bg-white/25`.
- **read-path:** the `after-pitch-expert` pair, cropped to the timeline band.

**On cream this rendered as a single glowing ember dot with nothing around it.** Four moments, and
only the breakdown — which is `bg-ember-400`, a solid colour — survived. The track that makes the
dots read as one conversation, and the three other moments, were white at 12% and 25% on a
near-white ground.

Same shape as the dial gauges found an hour ago, on the screen the product calls its output.

### The "Your read" toggle

- **write-path:** the prominent `CollapseToggle`'s label, chevron and bulb icon: `text-ember-200`
  and `text-ember-300` → `text-ember-700 dark:text-…`.
- **read-path:** the `after-pitch` pair, cropped to the card header.

`ember-200` is the palest step in the scale, on `bg-ember-400/15`, which over cream is a pale amber
card. Pale on pale. `ember-700` is the value `globals.css:120` records as measured at 4.5–4.9:1 on
light — the fix the founder's own "too light, hard to see" report produced on 2026-07-24.

It renders as "HIDE" when open and "TAP TO OPEN" when closed. Both states were captured, because
the toggle's two labels are two different strings in the same element.

### Thirteen raw tints

- **write-path:** every `text-{emerald,amber,rose}-{300,400}` in the file mode-split to
  `-{600,700} dark:-{300,400}`, by regex with a `(?<!dark:)` guard so nothing already split was
  touched. 13 replacements, verified by re-grep → 0 unsplit remaining.
- **read-path:** the timeline band, where the most important one lives.

The breakdown moment's label under its dot was `text-amber-300 font-semibold` at 10px. **The single
most important word on the timeline was its least readable element** — the third time today that
sentence has been literally true, after the Analytics grade scale and the roleplay composer.

### The capture

- **write-path:** `src/test/captures/afterPitch.capture.tsx` — three states: Standard populated,
  Standard thin, Expert populated. Six images.

`useExperienceMode` is mocked through a mutable holder rather than a constant, because the two
branches are two screens and a Standard-only capture leaves every timeline value unphotographed.

```
$ npm run visual -- afterPitch
      Tests  3 passed (3)
  6 image(s) in artifacts/visual/
exit 0
```
