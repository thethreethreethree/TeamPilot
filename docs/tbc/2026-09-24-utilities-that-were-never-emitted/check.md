# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json                                  → exit 0
$ npx vitest run src/__tests__/no-wrong-namespace-color-utilities.test.ts → 2 passed
$ npm run visual                                                     → 62 captures
$ npm run check                                                      → see below
```

## The verification method

Snapshot all 62 captures, make the change, re-shoot, hash both sets. **11 of 62 differed.** Four
are in the known non-deterministic set (spinners, today's date). The other seven were each opened
as a before/after pair cropped to the pixel-diff bounding box, so the comparison is of the changed
region rather than of two large images.

## It was looked at

**`scoreboard.light`, before** — rank 1, Jordan Ellis: the word "YOU" as bare dark text with no
pill, beside an "Elite" chip that has one; the row itself the same colour as every other row.

**`scoreboard.light`, after** — "YOU" in a grey pill matching its neighbour, and **row 1 carries a
light grey highlight**. On a leaderboard, that is the difference between finding yourself and not.

**`scoreboard.dark`, after** — the same chip as a light grey pill with dark text, the same row
highlight one step lighter than the card. Correct on the other ground.

**`pattern-interrupt.light`, before** — "Done right in 5 pitches in a row. Clears automatically."
directly above "0 of 5 clean pitches in a row", with **nothing between them**.

**`pattern-interrupt.light`, after** — five grey segments between those two lines. The progress
track that the caption is counting.

**`pattern-interrupt.dark`, after** — the same five segments in dark grey against the card.

**`coach-assessment.light`** — the 22×24px diff is the "Grading…" spinner mid-rotation. Known
non-determinism, not this change.

**`sessions-expert.light` / `sessions-empty.light`** — the diff regions are the video honesty
notice and the filter controls, both from the PREVIOUS commit. Their snapshots in the `pre` set
were stale. **Stated rather than attributed to this change**, because a diff appearing in a
comparison is not evidence about what caused it.

## Findings

### `bg-<token>` was never a utility

class: a design token used with a CSS property the config never registered it on
sweep: Tailwind's own `resolveConfig`, all names on per-property scales × all colour prefixes, across `src/{app,components,lib}` → **56 uses / 21 files** total; the `bg-` subset is 26 uses / 15 files
severity: high

**[OBSERVED]** `resolved.backgroundColor.primary` — and `secondary`, `muted`, `default`, `strong`,
`accent-text` — is `undefined`.

**[OBSERVED]** Every one of the 26 sites is a thing meant to be seen: a status dot for an "off"
state, a 1px rule, a toggle knob, a chip tint, a progress track.

**[OBSERVED]** Two of them are confirmed by before/after captures — the Scoreboard "YOU" chip and
row highlight, and the Pattern Interrupt progress track.

High because of the failure mode. **It type-checks, it lints, it passes the twelve-step gate, and
the class name is still on the element in devtools, which makes it look applied.** The element
renders with no fill, and an element with no fill is indistinguishable from one that was never
meant to have one.

### The member whose author picked the wrong token

class: not the above — a single site where the intended meaning differs from the namespace's
sweep: all 26 read individually before any were changed
severity: high, one site

**[OBSERVED]** `CalibrationTool.tsx:128` is `bg-primary … text-white` on the "Submit & compare"
button. Today: white text on the page background, invisible on cream.

**[OBSERVED]** `--text-primary` is ink-900 on light and ink-50 on dark. Registering `bg-primary`
would have made this button near-white with white text **in dark mode**.

**[INFERRED]** The author wanted the product's action colour, which is ember everywhere else in
this module. Changed to `bg-ember-400 / text-[#09090B]` to match.

## METHOD FAILURE worth recording

Two measurements of this class, both wrong, before the third one was trusted:

- A hand-written regex: **126 hits**, most of them `text-base` — a real Tailwind FONT-SIZE.
- A probe built on `resolveConfig`: **zero**, from a bug in the probe.

The zero is the dangerous one, and it is exactly what §1.7 means by an empty flag list being a
suspicious finding in itself. The instrument was then checked directly —
`resolved.backgroundColor.primary === undefined`, `bg-primary` present in four files — before any
count was believed.

## What this does not prove

**30 uses of the class remain, by the founder's decision**: `text-strong` (18), `border-accent-text`
(10), `border-primary` (2). The gate does not cover them and says so in its own docstring.

**Only `bg-` was swept for namespaces.** `ring-`, `divide-`, `outline-`, `caret-`,
`decoration-` and the gradient stops were not, though no use of a scoped token with those prefixes
appeared in the earlier full-prefix grep.

**Sites outside Sales Coach were fixed but not rendered** — the care module's tag dots and monitor
indicator, `ConversationsApp`, `ComposerToolbar`, the settings panels. They are fixed by the same
config line and verified only by reading.
