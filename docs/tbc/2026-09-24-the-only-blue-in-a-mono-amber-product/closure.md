# CLOSURE — the debt paid, and the thing beside it

## What is true now

`/calibration` has been rendered in both themes and both states. The submit button changed blind in
the previous build is correct. The five score sliders — and four checkboxes elsewhere — are ember
instead of Chrome blue.

Eight of twenty-three Sales Coach routes rendered. Six remain.

## Why this route

Not size. A debt: the previous closure said `/calibration` "mounts CalibrationTool, whose submit
button was changed in this build and has never been photographed."

I have spent this session drawing a line between *fixed and seen* and *fixed by pattern*, and
naming the second as the weaker claim. **A residual that names a weaker claim and then moves on is
a tidier way of not checking.** This one is now paid. Three of the same kind are still open, and
they are named below rather than left implied.

## The thing beside it

The button was correct. The five sliders above it were **bright Chrome blue** — a native
`<input type="range">` with no `accent-color`, in a product whose own brand note says *"our
mono-amber identity, NOT the PDF's blue/red … ('no red')"*.

Nothing was invisible and nothing was unusable, which is why no test and no sweep had ever cared.
It was simply the only blue in the product, on the primary input of a manager-facing screen, and
`accent-ember-400` was already the convention at ten other call sites.

That is the fourth time today a real defect has been found by looking at a screen for a different
reason entirely.

## The counting problem, twice in two builds

The previous build's probe said **zero** for a class with 56 members. This build's scanner said
**18** for a class with 5, by truncating each JSX element at the first `>` — which in this codebase
is nearly always inside `onChange={(e) => …}`.

Both were caught by reading the members, and in both cases reading them was faster than writing the
scanner had been.

**A count is not a finding.** The finding is the members; the count is a claim about how many there
are, and it is the part most likely to be wrong.

## Residual

```json
[
  {
    "id": "R1-four-checkbox-fixes-not-rendered",
    "item": "MeetingCoachingPanel, team, finance/contractors and finance/controls got `accent-ember-400` by applying an established convention, not by being seen.",
    "why_skipped": "No captures exist for those surfaces; three are outside Sales Coach.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T10:40:40Z",
    "outcome": "OPEN and small. A checkbox turning from blue to ember is the lowest-risk change in this session, and it is still a 'fixed by pattern' claim, which is the distinction this build exists to honour."
  },
  {
    "id": "R2-no-gate-for-the-accent-class-and-why",
    "item": "No automated check that native controls carry an accent colour.",
    "why_skipped": "Declined deliberately. A JSX-reading gate cannot see a CSS module, so it would demand an accent on WowDifferentiator's range — `opacity: 0`, `appearance: none`, an invisible drag surface over a custom divider.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T10:40:40Z",
    "outcome": "OPEN by choice. One false positive in six on a class whose worst outcome is a wrongly-coloured control fails A30's test: it would be routed around, and quickly. Recorded so the absence is a decision rather than an oversight."
  },
  {
    "id": "R3-six-routes-remain",
    "item": "/settings (1060 lines, 9 white-alpha sites), /[id] (1159, 5), /kpi (909, 5), /training (379, 6), /team (376, 3), /team-chat, /door.",
    "why_skipped": "One at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T10:40:40Z",
    "outcome": "OPEN. `/settings` is next by size and is the screen a manager uses to set the company up — the most likely of the six to appear in a demo."
  },
  {
    "id": "R4-the-other-two-unpaid-seeing-debts",
    "item": "The non-Sales-Coach sites touched by the previous build's config line (care tag dots, ConversationsApp's drag handle, ComposerToolbar's separator, LearningModePanel's toggle knob, LlmConnectionPanel's status dot), and `RepActivity` inside the manager roster.",
    "why_skipped": "No captures; outside the demo path.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T10:40:40Z",
    "outcome": "OPEN, and listed together on purpose. LearningModePanel's toggle knob is the one worth seeing: an invisible switch handle is the same defect the founder personally reported on Macro Mode this morning, and it is currently claimed fixed on a pattern."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Four captures plus three crops were generated from this project's own components into
`artifacts/visual/` (git-ignored) and each was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, six Sales Coach routes, `RepActivity`, and the four checkbox surfaces fixed in this build.
