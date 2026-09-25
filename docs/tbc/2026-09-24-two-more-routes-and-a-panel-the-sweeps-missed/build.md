# BUILD

### `/settings` — nine containers, fourteen tints

- **write-path:** nine `border border-white/[0.07] bg-white/[0.02]` → `border-default bg-surface`
  (including the `Row` at :221, which is why the three account rows had no pills); two
  `border-white/15 hover:border-white/30` → `border-default hover:border-strong`; fourteen raw
  tints mode-split.
- **read-path:** `settings-account` and `settings-coaching`, both themes.

The Account tab's three rows — Name, Elostate role, Sales Coach role — are each a CARD. On cream
they had no container at all, so the labels and values floated; in dark they are three clear pills.

**The Learning Mode toggle knob is visible here**, which pays off a residual from two builds ago:
it was `bg-secondary`, a utility that did not exist, and was fixed at the config. Until this
capture that fix was a claim about a pattern. It is now a claim about a picture.

### `/training` — six containers, and three screens

- **write-path:** six containers → `border-default bg-surface`; two tints mode-split.
- **read-path:** `training-manager`, `training-rep`, `training-error`, both themes.

"Your trainings" and "Your practice" are two cards in dark and two unbounded stretches of text on
cream.

The fixture gives `byFocus` one of each trend — up, flat, down — because `TrendChip` at :35 renders
a different word and colour for each, and a fixture with one trend photographs one branch. Same
reason the Scoreboard fixture put a rep in every band.

### `TeamTrainingBriefPanel` — the one the sweeps missed

- **write-path:** `border-white/[0.07] bg-white/[0.03]` → `border-default bg-surface`, and the
  selected period segment `bg-white/10` → `bg-surface-raised`.
- **read-path:** `training-manager`, both themes, cropped to the panel.

**Two reasons it survived every previous pass**, and both are worth keeping:

1. **It is not in the page.** `training/page.tsx` mounts `<TeamTrainingBriefPanel />` from another
   file. Every sweep I have run today has been per-file, against the file whose route I was
   rendering. A page is not its file.
2. **`bg-white/[0.03]`, not `[0.02]`.** Every fix in this session has been an exact-string replace
   of `border border-white/[0.07] bg-white/[0.02]` — a string chosen because it was the deck kit's.
   One hundredth of an alpha step makes that replace a no-op, silently.

And the defect inside it is the class this session keeps finding: `bg-white/10` marked the SELECTED
period. On cream, Day and Week looked identical — a segmented control with no visible selection.

### Verification that the remaining `white/` matches are intentional

Every file touched today still reporting a `white/` match was checked individually rather than
counted: each is the `dark:` half of a mode-split (`stroke-ink-300 dark:stroke-white/15`,
`bg-ink-200 dark:bg-white/10`, `text-ink-400 dark:text-white/50`), or one of the two lines on
`bg-brand-shell`, which is fixed-dark in both themes by design.

### The captures

- `salesCoachSettings.capture.tsx` — wraps the page in `ThemeProvider` + `ToastProvider`, with the
  reason and the production mount points recorded in the file.
- `training.capture.tsx` — serves by STATUS, not by body, because status is what picks the screen.

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- salesCoachSettings → 2 passed, 4 images
$ npm run visual -- training           → 3 passed, 6 images
```
