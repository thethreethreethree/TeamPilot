# CLOSURE — the correction, closed

## What is true now

The After Pitch Summary renders correctly in both themes and in both experience branches. Its
conversation timeline is a timeline on cream. Its most important label is its boldest. Its three
container sections have edges.

## Why this build exists

Forty minutes before it, I reported a render pass complete that was thirteen of twenty-three. The
correction named this screen as the one that mattered most: the natural end of the manager demo
path, the screen the product's own copy calls its real output, and the one I could say least about.

**A correction that names a gap and leaves it open is a better-written version of the same
failure.** This closes the named one. Nine routes remain, and they are named too.

## What was found here that the correction could not have predicted

**This page is two screens.** Standard and Expert diverge at `:715`, and the timeline — with the
breakdown moment and its correct line — exists only on Expert. A Standard-only capture would have
photographed this file, reported it rendered, and left every timeline value unseen.

That is "thirteen of thirteen" again, one level down, within an hour. Both times the work was real
and the coverage claim was measured against a denominator I had assumed. It is worth naming as a
pattern rather than as two incidents.

**And a promise the product makes about itself that it does not keep in the default mode.** One
Liners tells every rep, Standard included, that their real calls get "the full timeline and score
in the After Pitch Summary". In Standard there is no timeline. Not a rendering fault, not mine to
decide, and on the founder's desk.

## Residual

```json
[
  {
    "id": "R1-nine-routes-still-unrendered",
    "item": "/settings (9 own white/N), /sessions (8), /[id] (5), /kpi (5), /training (6), /team (3), /scoreboard (0, but its chart axes are stroke-white/10), /calibration, /team-chat, /door.",
    "why_skipped": "One at a time; this was the one the correction named as most consequential.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:35:00Z",
    "outcome": "OPEN. 38 white-alpha sites in unrendered page files. `/sessions` and `/settings` are the next two by size and by how likely a rep is to open them."
  },
  {
    "id": "R2-standard-has-no-timeline-but-is-promised-one",
    "item": "strategy/page.tsx promises every rep 'the full timeline and score in the After Pitch Summary'. The timeline is Expert-only.",
    "why_skipped": "Copy change or feature change — the founder's call, not a defect I should resolve.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:35:00Z",
    "outcome": "OPEN, on the founder's desk. Either the sentence is wrong or Standard is missing something it was designed to have."
  },
  {
    "id": "R3-the-hand-rolled-copies-beside-an-imported-kit",
    "item": "This file imports DeckCard at :23 and also hand-writes DeckCard's own recipe seven times. The producer fix an hour ago reached 22 cards in six files and missed these.",
    "why_skipped": "Fixed here; not swept codebase-wide.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:35:00Z",
    "outcome": "OPEN as a sweep: how many other files import the kit AND hand-roll its recipe? The previous build's 'fix the producer' argument is right and is not sufficient, and this is the measurement that would say by how much."
  },
  {
    "id": "R4-colour-only-decoration-is-the-invisible-class",
    "item": "Three instances today — dial ticks (stroke), timeline track (positioned span), timeline nodes (fill) — all missed by every border|bg|text sweep.",
    "why_skipped": "The gate is the theme-audit property-list widening, still the standing proposal.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:35:00Z",
    "outcome": "OPEN, and now with a tell worth more than the count: an element that exists ONLY as colour does not degrade when its colour fails, it disappears, and nothing in the DOM is missing."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Six captures plus four crops were generated from this project's own components into
`artifacts/visual/` (git-ignored). Each was opened and described, except the bottom third of
`after-pitch-expert.light`, which is empty canvas below the page's last line — stated rather than
claimed.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, and nine Sales Coach routes.
