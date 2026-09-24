# CLOSURE — the answer the page exists to give

## What is true now

On Pitch Analytics, a rep's skill grades are legible on both themes and the cards they sit in have
edges on cream. Dark is unchanged.

## The shape of it

The page promises, in its own copy, "one score per skill, so you know exactly what to work on next".

The score below 5 is that answer. It rendered at roughly 1.5:1 on cream. The band above 8 — a rep's
best skill — had the same defect. The mediocre middle band, between them, rendered perfectly,
because that one branch used `text-brand` and the two either side used raw `-300` tints.

The correct pattern was not somewhere else in the codebase to be discovered. It was in the same
ternary, one branch away, written by the same hand on the same day.

## Why that is the interesting part

Every defect today has had this quality: the knowledge needed to avoid it was already present, and
close.

- `pitch-score/route.ts:21` describes the exact class of the missing pipeline, one layer down.
- `recover-transcripts-cron` solved "nothing ever tried" for transcripts two weeks before the same
  gap was found in scoring.
- `outcomeLabels.ts` exists because four copies were consolidated; a fifth was written afterwards.
- `globals.css:120` records the founder reporting "too light, hard to see", and a line written two
  days ago bypassed the fix.
- And here, the right token is one branch away in the same expression.

None of it is carelessness. It is what happens when a decision is made correctly in one place and
the next person — often the same person — makes it again somewhere else without looking up.

## Residual

```json
[
  {
    "id": "R1-the-emerald-band-was-never-rendered",
    "item": "No fixture score reached 8, so the `>= 8` branch is fixed by reading rather than by seeing.",
    "why_skipped": "One more fixture variant; the sibling branch was observed and the values are the same family.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T07:35:00Z",
    "outcome": "OPEN and small. Worth naming because 'fixed by pattern' is a weaker claim than 'fixed and seen', and the distinction has been kept everywhere else today."
  },
  {
    "id": "R2-two-surfaces-left",
    "item": "Roleplay and One Liners have not been rendered.",
    "why_skipped": "Each needs its own capture and fixture.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T07:35:00Z",
    "outcome": "OPEN. Eleven of thirteen done; the running yield is ten real defects, five phantoms and three clean screens. On that rate the remaining two are not a formality."
  },
  {
    "id": "R3-the-white-alpha-count-still-stands",
    "item": "256 `white/N` uses across 47 files, measured this morning. Two surfaces have now been confirmed out of it; the rest are unexamined.",
    "why_skipped": "Only rendering separates a fixed-dark surface, where the value is correct, from a theme-following one, where it vanishes.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T07:35:00Z",
    "outcome": "OPEN, and the argument for render-before-gate is stronger than when it was made: two of eleven rendered surfaces were members, and several of the largest unexamined files are deliberately dark. A gate written today would have flagged those and been routed around by tomorrow."
  },
  {
    "id": "R4-paleText-deferred-a-third-time",
    "item": "theme-audit's category for this exact family stops at -200; every value fixed today was -300.",
    "why_skipped": "Same reason, three times: widening it flags correct code until the fixed-dark surfaces are rendered.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T07:35:00Z",
    "outcome": "OPEN. Deferring the same gate three times in one day is worth flagging as a pattern rather than repeating the reason a fourth time — the render pass is the blocker, and it is two surfaces from done."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Four captures plus one cropped strip were generated from this project's own components into
`artifacts/visual/` (git-ignored) and each was opened and described — before and after, in both
themes.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and two of the thirteen Sales Coach screens.
