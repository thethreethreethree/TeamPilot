# CLOSURE — a class the codebase had already named and left open

## What is true now

Twenty-six `bg-` utilities that emitted no CSS now emit CSS. The Scoreboard highlights your own
row and gives the "YOU" chip a pill. Pattern Interrupt draws the progress track its caption counts.
Status dots have an off state. The Learning Mode toggle has a knob when it is off. The Calibration
tool's submit button has a background in both themes.

And there is a gate that fails when any of it comes back.

## The shape of it

`stroke-primary` in the previous build was one instance. The class is: **a design token used with
a CSS property the config never registered it on.** Tailwind emits nothing, `tsc` is happy because
it is a string, ESLint is happy, the twelve-step gate is happy, and the class name is still on the
element in devtools — which is what makes it look applied.

The codebase had already named this class. `no-invisible-bare-color-utilities.test.ts` guards its
neighbour and its own comment says, of these exact tokens, *"a different 'wrong-namespace'
concern, out of scope for THIS guard."* Named, documented, and left open — and the note has read
like coverage ever since.

The class exists because of a **correct** decision, which is the part worth keeping. V7 (2026-07-22)
was a colour called `base` on top-level `colors` colliding with the `text-base` FONT-SIZE utility,
turning every `text-base` element's text the colour of the page background. The fix — register
semantic tokens on per-property scales — was right, and its cost is that a token is valid only for
the properties it was registered on. Nothing enforced that until now.

## The two halves of "fix the producer"

The deck-kit build this morning concluded: find the producer, stop fixing instances one at a time.
That was right and it reached 22 cards in six files with one change.

This build is the other half. The producer fix — six config lines — is correct for 25 of the 26
sites and **wrong for the twenty-sixth**. `CalibrationTool`'s submit button is `bg-primary` with
`text-white`; `--text-primary` is near-black on light and near-**white** on dark, so registering
the utility would have moved the button's invisibility from one theme to the other and looked like
a fix.

Twenty-five authors meant "the muted ink" or "the default border". One meant "the primary action
colour" and reached for the wrong word. **A producer fix is still applied to a set of instances,
and the set has to be read.**

## And a note on how this was measured

Three times. A hand regex said 126, nearly all of them `text-base`, which is a font-size. A probe
built on Tailwind's own resolver said **zero**. Neither was true.

The zero is the one that mattered, and §1.7 names it: an empty flag list is itself a suspicious
finding. It cost nothing only because the instrument was checked against a known value before any
number was believed. **A checker's first clean result is evidence about the checker.**

## Residual

```json
[
  {
    "id": "R1-thirty-uses-of-this-class-remain-by-decision",
    "item": "text-strong (18 uses, 3 files), border-accent-text (10, 4 files), border-primary (2, 2 files) are members of this class and are not covered by the gate.",
    "why_skipped": "The founder scoped the fix to `bg-`. For `text-strong` there is a substantive reason: a no-op `text-` inherits its parent colour, so those 18 places currently look like what was reviewed and approved. Making it resolve would CHANGE them.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T10:33:32Z",
    "outcome": "OPEN, and named with counts inside the test file itself so the exclusion is visible rather than silent. The `border-` ones are the likelier real defects of the two groups: a missing border is a missing edge, where a missing text colour is an inherited one."
  },
  {
    "id": "R2-only-bg-was-swept-for-namespaces",
    "item": "`ring-`, `divide-`, `outline-`, `caret-`, `decoration-` and the gradient stops were not swept, though no scoped-token use with those prefixes appeared in the earlier full-prefix grep.",
    "why_skipped": "The gate covers `bg-`; widening it is a one-line change to the test once the other prefixes' offenders are fixed.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T10:33:32Z",
    "outcome": "OPEN and small. The grep found none, so this is a gap in the GATE rather than a suspected defect."
  },
  {
    "id": "R3-non-sales-coach-sites-fixed-but-not-rendered",
    "item": "The care module's tag dots and monitor indicator, ConversationsApp's drag handle, ComposerToolbar's separator, LearningModePanel's toggle knob and LlmConnectionPanel's status dot are all fixed by the config line and verified only by reading.",
    "why_skipped": "No captures exist for those surfaces, and they are outside the Sales Coach work the founder is preparing to demo.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T10:33:32Z",
    "outcome": "OPEN. 'Fixed by pattern' is a weaker claim than 'fixed and seen', and roughly half of this build's sites are in the weaker category. The Learning Mode toggle knob is the one I would look at first — an invisible switch handle is the same defect the founder personally reported on Macro Mode this morning."
  },
  {
    "id": "R4-seven-sales-coach-routes-still-unrendered",
    "item": "/settings, /[id], /kpi, /training, /team, /calibration, /team-chat, /door.",
    "why_skipped": "One at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T10:33:32Z",
    "outcome": "OPEN. `/calibration` is now interesting for a reason it was not an hour ago: it mounts CalibrationTool, whose submit button was changed in this build and has never been photographed."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
62 captures were re-shot and hashed against a pre-change snapshot; the seven that differed outside
the known non-deterministic set were each opened as a before/after pair, cropped to the pixel-diff
bounding box.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, seven Sales Coach routes, the `RepActivity` sub-view, and every surface outside Sales Coach
touched by the config line.
